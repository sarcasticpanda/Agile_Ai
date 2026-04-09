import Project from '../models/Project.model.js';
import User from '../models/User.model.js';
import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import { apiResponse } from '../utils/apiResponse.js';
import {
  queueProjectActiveSprintRiskRefresh,
  queueUserAiBurnoutRefresh,
} from '../services/aiRefresh.service.js';

import mongoose from 'mongoose';

const toIdString = (value) =>
  value && typeof value.toString === 'function' ? value.toString() : String(value || '');

const buildProjectMemberRemovalImpact = async (projectId, userId) => {
  const activeSprints = await Sprint.find({
    projectId,
    status: { $in: ['planning', 'active'] },
  })
    .select('_id title status')
    .lean();

  const activeSprintIds = new Set(activeSprints.map((s) => toIdString(s._id)));

  const assignedTasks = await Task.find({
    project: projectId,
    $or: [
      { assignee: userId },
      { 'assignees.user': userId },
      { 'subtasks.assignee': userId },
    ],
  })
    .select('_id title sprint status')
    .lean();

  const activeSprintAssignments = assignedTasks.filter((task) =>
    task?.sprint ? activeSprintIds.has(toIdString(task.sprint)) : false
  );

  const backlogAssignments = assignedTasks.filter((task) => !task?.sprint);

  return {
    totalAssignments: assignedTasks.length,
    activeSprintAssignments: activeSprintAssignments.length,
    backlogAssignments: backlogAssignments.length,
    activeSprints: activeSprints.map((s) => ({ _id: s._id, title: s.title, status: s.status })),
    activeSprintTaskSample: activeSprintAssignments.slice(0, 5).map((task) => ({
      _id: task._id,
      title: task.title,
      sprint: task.sprint,
      status: task.status,
    })),
    canRemoveWithoutForce: activeSprintAssignments.length === 0,
  };
};

const unassignUserFromProjectTasks = async (projectId, userId) => {
  const uid = toIdString(userId);
  if (!uid) return 0;

  const tasks = await Task.find({
    project: projectId,
    $or: [
      { assignee: userId },
      { 'assignees.user': userId },
      { 'subtasks.assignee': userId },
    ],
  });

  let changed = 0;

  for (const task of tasks) {
    let touched = false;

    if (task.assignee && toIdString(task.assignee) === uid) {
      task.assignee = null;
      touched = true;
    }

    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      const nextAssignees = task.assignees.filter((entry) => toIdString(entry?.user) !== uid);
      if (nextAssignees.length !== task.assignees.length) {
        task.assignees = nextAssignees;
        touched = true;
      }
    }

    if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      task.subtasks = task.subtasks.map((sub) => {
        if (sub?.assignee && toIdString(sub.assignee) === uid) {
          touched = true;
          return { ...sub.toObject(), assignee: null };
        }
        return sub;
      });
    }

    if (touched) {
      await task.save();
      changed += 1;
    }
  }

  return changed;
};

export const getProjects = async (req, res) => {
  let query = { status: { $ne: 'archived' } };
  
  // Admins see all projects. PMs and Devs only see projects they own or belong to.
  if (req.user.role !== 'admin') {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    query = {
      status: { $ne: 'archived' },
      $or: [{ owner: userId }, { 'members.user': userId }],
    };
  }

  const projects = await Project.find(query)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name avatar role');

  apiResponse(res, 200, true, projects, 'Projects fetched successfully');
};

export const createProject = async (req, res) => {
  const { title, description, color, organizationId, key } = req.body;

  const project = await Project.create({
    title,
    key: key ? key.toUpperCase() : undefined, // Include the key so tasks can prefix it
    description,
    color,
    organization: organizationId || null,
    orgId: organizationId || null, // Capture orgId securely from creation context (handled appropriately if multi-tenant later)
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'pm' }],
  });

  apiResponse(res, 201, true, project, 'Project created successfully');
};

export const getProjectById = async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar role');

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  // Check membership
  const isMember = project.members.some(
    (member) => member.user._id.toString() === req.user._id.toString()
  );
  if (!isMember && project.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return apiResponse(res, 403, false, null, 'Not authorized to view this project');
  }

  apiResponse(res, 200, true, project, 'Project fetched successfully');
};

export const updateProject = async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  const updatedProject = await Project.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );

  apiResponse(res, 200, true, updatedProject, 'Project updated successfully');
};

export const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  project.status = 'archived';
  await project.save();

  apiResponse(res, 200, true, null, 'Project archived successfully');
};

export const getMembers = async (req, res) => {
  const project = await Project.findById(req.params.id).populate(
    'members.user',
    'name email avatar role'
  );

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  apiResponse(res, 200, true, project.members, 'Members fetched successfully');
};

export const addMember = async (req, res) => {
  const { email, role } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return apiResponse(res, 404, false, null, 'User not found');
  }

  // Phase 4 - Hierarchy enforcement: PMs can only add Developers assigned to them
  if (req.user.role === 'pm') {
    if (user.role === 'admin') {
      return apiResponse(res, 403, false, null, 'You cannot add an Admin to a project.');
    }
    // Note: PMs can potentially add other PMs if they want, but usually just developers.
    // Let's enforce that if adding a developer, they must be managed by this PM.
    if (user.role === 'developer' && user.managedBy?.toString() !== req.user._id.toString()) {
      return apiResponse(res, 403, false, null, 'Hierarchy Error: You can only add developers that are officially assigned to you by an Admin.');
    }
  }

  const project = await Project.findById(req.params.id);
  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  if (req.user.role === 'pm') {
    const isOwnerOrMember = project.owner.toString() === req.user._id.toString() || 
      project.members.some(m => m.user.toString() === req.user._id.toString());
    if (!isOwnerOrMember) {
      return apiResponse(res, 403, false, null, 'You can only add members to projects you manage.');
    }
  }

  // Check if member already exists
  const isMember = project.members.some((m) => m.user.toString() === user._id.toString());
  if (isMember) {
    return apiResponse(res, 400, false, null, 'User is already a member');
  }

  project.members.push({ user: user._id, role: role || 'developer' });
  await project.save();

  queueUserAiBurnoutRefresh(user._id);
  await queueProjectActiveSprintRiskRefresh(project._id);

  apiResponse(res, 200, true, project.members, 'Member added successfully');
};

export const removeMember = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  if (req.user.role === 'pm') {
    const isOwnerOrMember = project.owner.toString() === req.user._id.toString() ||
      project.members.some((m) => m.user.toString() === req.user._id.toString());
    if (!isOwnerOrMember) {
      return apiResponse(res, 403, false, null, 'You can only manage members in projects you manage.');
    }
  }

  const memberExists = project.members.some((m) => toIdString(m.user) === toIdString(req.params.uid));
  if (!memberExists) {
    return apiResponse(res, 404, false, null, 'User is not a member of this project');
  }

  const impact = await buildProjectMemberRemovalImpact(project._id, req.params.uid);
  const forceRemoval = String(req.query.force || req.body?.force || '').toLowerCase() === 'true';

  if (impact.activeSprintAssignments > 0 && !forceRemoval) {
    return apiResponse(
      res,
      409,
      false,
      { impact },
      'Member has active sprint assignments. Confirm force removal to proceed.'
    );
  }

  project.members = project.members.filter(
    (m) => m.user.toString() !== req.params.uid
  );
  await project.save();

  const unassignedTasks = await unassignUserFromProjectTasks(project._id, req.params.uid);

  queueUserAiBurnoutRefresh(req.params.uid);
  await queueProjectActiveSprintRiskRefresh(project._id);

  apiResponse(
    res,
    200,
    true,
    {
      members: project.members,
      impact,
      unassignedTasks,
      forced: forceRemoval,
    },
    'Member removed successfully'
  ); // Fixed by @Backend — standardized response shape
};

export const previewMemberRemovalImpact = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  if (req.user.role === 'pm') {
    const isOwnerOrMember = project.owner.toString() === req.user._id.toString() ||
      project.members.some((m) => m.user.toString() === req.user._id.toString());
    if (!isOwnerOrMember) {
      return apiResponse(res, 403, false, null, 'You can only manage members in projects you manage.');
    }
  }

  const memberExists = project.members.some((m) => toIdString(m.user) === toIdString(req.params.uid));
  if (!memberExists) {
    return apiResponse(res, 404, false, null, 'User is not a member of this project');
  }

  const impact = await buildProjectMemberRemovalImpact(project._id, req.params.uid);
  return apiResponse(res, 200, true, impact, 'Member removal impact preview ready');
};
