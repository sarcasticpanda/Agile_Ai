import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import Project from '../models/Project.model.js';
import { apiResponse } from '../utils/apiResponse.js';
import { queueSprintAiRiskRefresh, queueUserAiBurnoutRefresh } from '../services/aiRefresh.service.js';

import mongoose from 'mongoose';

const toIdString = (value) =>
  value && typeof value.toString === 'function' ? value.toString() : String(value || '');

const normalizeMemberIds = (rawMemberIds = []) => {
  if (!Array.isArray(rawMemberIds)) return [];
  const deduped = new Set();

  rawMemberIds.forEach((value) => {
    const id = toIdString(value);
    if (!id || id === 'null' || id === 'undefined') return;
    deduped.add(id);
  });

  return Array.from(deduped);
};

const queueBurnoutRefreshForTasks = (tasks = []) => {
  const ids = new Set();

  for (const task of tasks) {
    if (task?.assignee) ids.add(toIdString(task.assignee));

    for (const a of task?.assignees || []) {
      if (a?.user) ids.add(toIdString(a.user));
    }

    for (const sub of task?.subtasks || []) {
      if (sub?.assignee) ids.add(toIdString(sub.assignee));
    }
  }

  ids.delete('');
  ids.delete('null');
  ids.delete('undefined');

  Array.from(ids).forEach((id) => queueUserAiBurnoutRefresh(id));
};

const getAccessibleProjectIdSet = async (req) => {
  if (req.user.role === 'admin') return null;
  if (req._accessibleProjectIdSet) return req._accessibleProjectIdSet;

  const userId = new mongoose.Types.ObjectId(req.user._id);
  const userProjects = await Project.find({
    $or: [{ owner: userId }, { 'members.user': userId }],
  })
    .select('_id')
    .lean();

  req._accessibleProjectIdSet = new Set(userProjects.map((p) => String(p._id)));
  return req._accessibleProjectIdSet;
};

const ensureSprintAccess = async (req, res, sprint) => {
  if (req.user.role === 'admin') return true;

  const projectIds = await getAccessibleProjectIdSet(req);
  if (!projectIds.has(String(sprint.projectId))) {
    apiResponse(res, 403, false, null, 'Not authorized for this sprint');
    return false;
  }

  return true;
};

export const getSprints = async (req, res) => {
  const { projectId } = req.query;

  let query = {};
  
  if (req.user.role !== 'admin') {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const userProjects = await Project.find({
      $or: [{ owner: userId }, { 'members.user': userId }]
    }).select('_id');
    const allowedIds = userProjects.map(p => p._id.toString());
    
    if (projectId && projectId !== 'undefined') {
      if (!allowedIds.includes(projectId)) {
        return apiResponse(res, 403, false, null, 'Access denied to this project');
      }
      query.projectId = projectId;
    } else {
      query.projectId = { $in: allowedIds };
    }
  } else if (projectId && projectId !== 'undefined') {
    query.projectId = projectId;
  }

  const sprints = await Sprint.find(query)
    .populate('tasks')
    .populate('members', 'name avatar role')
    .sort({ createdAt: -1 });

  apiResponse(res, 200, true, sprints, 'Sprints fetched successfully');
};

export const createSprint = async (req, res) => {
  const { title, goal, startDate, endDate, projectId } = req.body;
  const memberIds = normalizeMemberIds(req.body?.memberIds || []);

  if (req.user.role !== 'admin') {
    if (!projectId) {
      return apiResponse(res, 400, false, null, 'projectId is required');
    }
    const projectIds = await getAccessibleProjectIdSet(req);
    if (!projectIds.has(String(projectId))) {
      return apiResponse(res, 403, false, null, 'Not authorized for this project');
    }
  }

  let validatedMemberIds = [];
  if (memberIds.length > 0) {
    const project = await Project.findById(projectId).select('owner members.user').lean();
    if (!project) {
      return apiResponse(res, 404, false, null, 'Project not found');
    }

    const allowedMemberIds = new Set([
      toIdString(project.owner),
      ...(Array.isArray(project.members) ? project.members.map((m) => toIdString(m.user)) : []),
    ]);

    const invalidMembers = memberIds.filter((id) => !allowedMemberIds.has(toIdString(id)));
    if (invalidMembers.length > 0) {
      return apiResponse(
        res,
        400,
        false,
        { invalidMembers },
        'All sprint members must belong to the selected project'
      );
    }

    validatedMemberIds = memberIds;
  }

  const sprint = await Sprint.create({
    title,
    goal,
    startDate,
    endDate,
    projectId: projectId,
    members: validatedMemberIds,
  });

  apiResponse(res, 201, true, sprint, 'Sprint created successfully');
};

export const getSprintById = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id)
    .populate('tasks')
    .populate('members', 'name avatar role');

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureSprintAccess(req, res, sprint))) {
    return;
  }

  apiResponse(res, 200, true, sprint, 'Sprint fetched successfully');
};

export const updateSprint = async (req, res) => {
  let sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureSprintAccess(req, res, sprint))) {
    return;
  }

  // Detect planned endDate extension while sprint is active.
  // Planned schedule remains in startDate/endDate; actual execution timestamps are startedAt/completedAt.
  const nextEndDate = req.body?.endDate ? new Date(req.body.endDate) : null;
  const prevEndDate = sprint.endDate ? new Date(sprint.endDate) : null;
  const willExtendPlannedEndDate =
    sprint.status === 'active' &&
    nextEndDate &&
    prevEndDate &&
    nextEndDate.getTime() > prevEndDate.getTime();

  sprint = await Sprint.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        ...req.body,
        ...(willExtendPlannedEndDate ? { wasExtended: true } : {}),
      },
    },
    { new: true }
  );

  apiResponse(res, 200, true, sprint, 'Sprint updated successfully');
};

export const deleteSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureSprintAccess(req, res, sprint))) {
    return;
  }

  // Remove sprint reference from tasks
  await Task.updateMany({ sprint: sprint._id }, { $set: { sprint: null } });
  
  await Sprint.findByIdAndDelete(req.params.id);

  apiResponse(res, 200, true, null, 'Sprint deleted successfully');
};

export const startSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureSprintAccess(req, res, sprint))) {
    return;
  }

  // Check if sprint is already active or completed
  if (sprint.status === 'active') {
    return apiResponse(res, 400, false, null, 'Sprint is already active');
  }
  if (sprint.status === 'completed') {
    return apiResponse(res, 400, false, null, 'Sprint is already completed');
  }

  sprint.status = 'active';
  if (!sprint.startedAt) {
    sprint.startedAt = new Date();
  }
  if (!sprint.originalEndDateAtStart && sprint.endDate) {
    sprint.originalEndDateAtStart = sprint.endDate;
  }

  if (!Array.isArray(sprint.members) || sprint.members.length === 0) {
    const project = await Project.findById(sprint.projectId).select('members.user').lean();
    sprint.members = Array.isArray(project?.members) ? project.members.map((m) => m.user) : [];
  }

  // Lock committed points at sprint start (sum of current sprint tasks)
  const sprintTasks = await Task.find({ sprint: sprint._id }).select(
    'storyPoints status assignee assignees.user subtasks.assignee'
  );
  sprint.committedPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  sprint.completedPoints = sprintTasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  await sprint.save();

  queueSprintAiRiskRefresh(sprint._id);
  queueBurnoutRefreshForTasks(sprintTasks);

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${sprint.projectId}`).emit('sprint:status_changed', sprint);
  }

  // ✅ CRITICAL FIX: Was missing apiResponse — caused frontend to hang forever
  apiResponse(res, 200, true, sprint, 'Sprint started successfully');
};

export const completeSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id).populate('tasks');

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureSprintAccess(req, res, sprint))) {
    return;
  }

  // Calculate points based on tasks in this sprint
  const completedPoints = sprint.tasks
    .filter((task) => task.status === 'done')
    .reduce((total, task) => total + (task.storyPoints || 0), 0);

  const totalPoints = sprint.tasks.reduce((total, task) => total + (task.storyPoints || 0), 0);

  sprint.status = 'completed';
  sprint.completedAt = new Date();
  sprint.completedPoints = completedPoints;

  // Compute wasExtended based on planned endDate changes during execution.
  if (sprint.originalEndDateAtStart && sprint.endDate) {
    sprint.wasExtended = new Date(sprint.endDate).getTime() > new Date(sprint.originalEndDateAtStart).getTime();
  }

  // If committedPoints was never locked (e.g., sprint completed without start), set it now.
  if (!sprint.committedPoints || sprint.committedPoints === 0) {
    sprint.committedPoints = totalPoints;
  }

  await sprint.save();

  queueSprintAiRiskRefresh(sprint._id);
  queueBurnoutRefreshForTasks(sprint.tasks || []);

  // Move incomplete tasks back to backlog
  const incompleteTasks = sprint.tasks.filter((task) => task.status?.toLowerCase() !== 'done');
  for (let task of incompleteTasks) {
    await Task.findByIdAndUpdate(task._id, { sprint: null });
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${sprint.projectId}`).emit('sprint:status_changed', sprint);
  }
  apiResponse(res, 200, true, sprint, 'Sprint completed successfully');
};
