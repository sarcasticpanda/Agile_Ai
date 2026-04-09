import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import Notification from '../models/Notification.model.js';
import { apiResponse } from '../utils/apiResponse.js';
import {
  queueProjectActiveSprintRiskRefresh,
  queueUserAiBurnoutRefresh,
} from '../services/aiRefresh.service.js';

const buildDeveloperAssignmentSummary = async (developerId) => {
  const projects = await Project.find({
    status: { $ne: 'archived' },
    'members.user': developerId,
  })
    .select('_id title status')
    .lean();

  const taskQuery = {
    $or: [
      { assignee: developerId },
      { 'assignees.user': developerId },
      { 'subtasks.assignee': developerId },
    ],
  };

  const assignedTasks = await Task.find(taskQuery).select('_id sprint status').lean();

  const sprintIds = Array.from(
    new Set(
      assignedTasks
        .map((task) => (task?.sprint ? String(task.sprint) : null))
        .filter(Boolean)
    )
  );

  let activeSprintCount = 0;
  if (sprintIds.length > 0) {
    activeSprintCount = await Sprint.countDocuments({
      _id: { $in: sprintIds },
      status: { $in: ['planning', 'active'] },
    });
  }

  return {
    projects,
    projectCount: projects.length,
    sprintCount: sprintIds.length,
    activeSprintCount,
    taskCount: assignedTasks.length,
    openTaskCount: assignedTasks.filter((task) => String(task.status || '').toLowerCase() !== 'done').length,
  };
};

const buildReleaseImpact = async ({ developerId, ownerId, includeAllProjects = false }) => {
  const projectQuery = {
    status: { $ne: 'archived' },
    'members.user': developerId,
  };

  if (!includeAllProjects) {
    projectQuery.owner = ownerId;
  }

  const relatedProjects = await Project.find(projectQuery).select('_id title').lean();
  const projectIds = relatedProjects.map((p) => p._id);

  if (projectIds.length === 0) {
    return {
      projectIds: [],
      relatedProjects: [],
      totalAssignments: 0,
      activeSprintAssignments: 0,
      activeSprintTaskSample: [],
      canReleaseWithoutForce: true,
    };
  }

  const activeSprints = await Sprint.find({
    projectId: { $in: projectIds },
    status: { $in: ['planning', 'active'] },
  })
    .select('_id title projectId status')
    .lean();

  const activeSprintIds = new Set(activeSprints.map((s) => String(s._id)));
  const activeSprintById = new Map(activeSprints.map((s) => [String(s._id), s]));

  const assignments = await Task.find({
    project: { $in: projectIds },
    $or: [
      { assignee: developerId },
      { 'assignees.user': developerId },
      { 'subtasks.assignee': developerId },
    ],
  })
    .select('_id title project sprint status')
    .lean();

  const activeAssignments = assignments.filter((task) =>
    task?.sprint ? activeSprintIds.has(String(task.sprint)) : false
  );

  return {
    projectIds,
    relatedProjects,
    totalAssignments: assignments.length,
    activeSprintAssignments: activeAssignments.length,
    activeSprintTaskSample: activeAssignments.slice(0, 5).map((task) => ({
      _id: task._id,
      title: task.title,
      project: task.project,
      sprint: activeSprintById.get(String(task.sprint))
        ? {
            _id: activeSprintById.get(String(task.sprint))._id,
            title: activeSprintById.get(String(task.sprint)).title,
            status: activeSprintById.get(String(task.sprint)).status,
          }
        : task.sprint,
      status: task.status,
    })),
    canReleaseWithoutForce: activeAssignments.length === 0,
  };
};

const unassignDeveloperFromProjects = async ({ developerId, projectIds = [] }) => {
  if (!Array.isArray(projectIds) || projectIds.length === 0) return 0;

  const uid = String(developerId);
  const tasks = await Task.find({
    project: { $in: projectIds },
    $or: [
      { assignee: developerId },
      { 'assignees.user': developerId },
      { 'subtasks.assignee': developerId },
    ],
  });

  let changed = 0;

  for (const task of tasks) {
    let touched = false;

    if (task.assignee && String(task.assignee) === uid) {
      task.assignee = null;
      touched = true;
    }

    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      const nextAssignees = task.assignees.filter((entry) => String(entry?.user) !== uid);
      if (nextAssignees.length !== task.assignees.length) {
        task.assignees = nextAssignees;
        touched = true;
      }
    }

    if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      task.subtasks = task.subtasks.map((sub) => {
        if (sub?.assignee && String(sub.assignee) === uid) {
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

export const createDeveloper = async (req, res) => {
  try {
    const { name, email, password, projectId } = req.body;
    
    // Create explicitly as a developer managed by this PM
    const user = await User.create({
      name,
      email,
      password,
      role: 'developer',
      status: 'active',
      managedBy: req.user._id,
      createdBy: req.user._id
    });

    if (projectId) {
      const project = await Project.findById(projectId);
      if (project && project.owner.toString() === req.user._id.toString()) {
        project.members.push({ user: user._id, role: 'developer' });
        await project.save();
        await queueProjectActiveSprintRiskRefresh(project._id);
        queueUserAiBurnoutRefresh(user._id);
      }
    }

    await Notification.create({
      user: user._id,
      title: 'Welcome to AgileAI',
      message: `You have been added to the team by ${req.user.name}.`,
      type: 'user_created',
      read: false
    });

    apiResponse(res, 201, true, { user }, 'Developer created successfully');
  } catch (error) {
    if (error.code === 11000) return apiResponse(res, 400, false, null, 'Email already exists');
    apiResponse(res, 500, false, null, 'Server error creating developer');
  }
};

export const getFreePool = async (req, res) => {
  try {
    const freeDevelopers = await User.find({
      role: 'developer',
      status: 'active',
      managedBy: null
    }).select('-password');

    const enriched = await Promise.all(
      freeDevelopers.map(async (dev) => {
        const summary = await buildDeveloperAssignmentSummary(dev._id);
        return {
          ...dev.toObject(),
          ...summary,
        };
      })
    );

    apiResponse(res, 200, true, enriched, 'Fetched free pool successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error fetching free pool');
  }
};

export const getMyDevelopers = async (req, res) => {
  try {
    const developers = await User.find({
      role: 'developer',
      status: 'active',
      managedBy: req.user._id
    }).select('-password');
    
    // Enrich with actual project count per developer
    const enriched = await Promise.all(developers.map(async (dev) => {
      const summary = await buildDeveloperAssignmentSummary(dev._id);
      const devObj = dev.toObject();
      devObj.projects = summary.projects;
      devObj.projectCount = summary.projectCount;
      devObj.sprintCount = summary.sprintCount;
      devObj.activeSprintCount = summary.activeSprintCount;
      devObj.taskCount = summary.taskCount;
      devObj.openTaskCount = summary.openTaskCount;
      return devObj;
    }));

    apiResponse(res, 200, true, enriched, 'Fetched developers successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error fetching developers');
  }
};

export const getPendingDevelopers = async (req, res) => {
  try {
    const developers = await User.find({
      role: 'developer',
      status: 'pending'
    }).select('-password');
    // Note: Blueprint says "managedBy = req.user._id", 
    // but self-registered devs might not have managedBy set initially. 
    // They would likely show up in a global pending pool or assigned pool. We return all pending for PM to claim/approve.

    apiResponse(res, 200, true, developers, 'Fetched pending developers successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error fetching pending developers');
  }
};

export const releaseDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);
    if (!developer) return apiResponse(res, 404, false, null, 'Developer not found');

    if (developer.managedBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return apiResponse(res, 403, false, null, 'Not authorized to release this developer');
    }

    const releaseImpact = await buildReleaseImpact({
      developerId: developer._id,
      ownerId: req.user._id,
      includeAllProjects: req.user.role === 'admin',
    });

    const forceRelease = String(req.query.force || req.body?.force || '').toLowerCase() === 'true';
    if (releaseImpact.activeSprintAssignments > 0 && !forceRelease) {
      return apiResponse(
        res,
        409,
        false,
        { impact: releaseImpact },
        'Developer has active sprint assignments. Confirm force release to continue.'
      );
    }

    if (releaseImpact.projectIds.length > 0) {
      await Project.updateMany(
        { _id: { $in: releaseImpact.projectIds } },
        { $pull: { members: { user: developer._id } } }
      );
    }

    const unassignedTasks = await unassignDeveloperFromProjects({
      developerId: developer._id,
      projectIds: releaseImpact.projectIds,
    });

    developer.managedBy = null;
    await developer.save();

    queueUserAiBurnoutRefresh(developer._id);
    for (const projectId of releaseImpact.projectIds) {
      await queueProjectActiveSprintRiskRefresh(projectId);
    }

    apiResponse(
      res,
      200,
      true,
      {
        developer: developer.toObject(),
        impact: releaseImpact,
        unassignedTasks,
        forced: forceRelease,
      },
      'Developer released successfully'
    );
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error releasing developer');
  }
};

export const previewReleaseDeveloperImpact = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);
    if (!developer) return apiResponse(res, 404, false, null, 'Developer not found');

    if (developer.managedBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return apiResponse(res, 403, false, null, 'Not authorized to release this developer');
    }

    const impact = await buildReleaseImpact({
      developerId: developer._id,
      ownerId: req.user._id,
      includeAllProjects: req.user.role === 'admin',
    });

    return apiResponse(res, 200, true, impact, 'Developer release impact preview ready');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error previewing release impact');
  }
};

export const approveDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);
    if (!developer) return apiResponse(res, 404, false, null, 'Developer not found');

    developer.status = 'active';
    developer.managedBy = req.user._id; // Claiming ownership upon approval
    await developer.save();
    queueUserAiBurnoutRefresh(developer._id);

    const { projectId } = req.body;
    if (projectId) {
      const project = await Project.findById(projectId);
      if (project && project.owner.toString() === req.user._id.toString()) {
        const isMember = project.members.find(m => m.user.toString() === developer._id.toString());
        if (!isMember) {
          project.members.push({ user: developer._id, role: 'developer' });
          await project.save();
          await queueProjectActiveSprintRiskRefresh(project._id);
          queueUserAiBurnoutRefresh(developer._id);
        }
      }
    }

    await Notification.create({
      user: developer._id,
      title: 'Account Approved',
      message: `Your account was approved and claimed by ${req.user.name}.`,
      type: 'user_assigned',
      read: false
    });

    apiResponse(res, 200, true, { user: developer }, 'Developer approved successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error approving developer');
  }
};

export const claimDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);
    if (!developer) return apiResponse(res, 404, false, null, 'Developer not found');

    if (developer.role !== 'developer') {
      return apiResponse(res, 400, false, null, 'Can only claim developers');
    }
    if (developer.status !== 'active') {
      return apiResponse(res, 400, false, null, 'Developer must be active (admin-approved) before claiming');
    }
    if (developer.managedBy && developer.managedBy.toString() !== req.user._id.toString()) {
      return apiResponse(res, 400, false, null, 'Developer is already assigned to another PM');
    }

    developer.managedBy = req.user._id;
    await developer.save();

    await Notification.create({
      user: developer._id,
      title: 'Team Assignment',
      message: `You have been assigned to ${req.user.name}'s team.`,
      type: 'user_assigned',
      read: false
    });

    const summary = await buildDeveloperAssignmentSummary(developer._id);
    const enrichedDev = developer.toObject();
    enrichedDev.projects = summary.projects;
    enrichedDev.projectCount = summary.projectCount;
    enrichedDev.sprintCount = summary.sprintCount;
    enrichedDev.activeSprintCount = summary.activeSprintCount;
    enrichedDev.taskCount = summary.taskCount;
    enrichedDev.openTaskCount = summary.openTaskCount;

    apiResponse(res, 200, true, enrichedDev, 'Developer claimed successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error claiming developer');
  }
};