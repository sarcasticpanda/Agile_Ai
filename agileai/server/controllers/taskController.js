import Task from '../models/Task.model.js';
import Sprint from '../models/Sprint.model.js';
import Project from '../models/Project.model.js';
import { apiResponse } from '../utils/apiResponse.js';
import {
  queueSprintAiRiskRefresh,
  queueTaskAiEffortRefresh,
  queueUserAiBurnoutRefresh,
} from '../services/aiRefresh.service.js';
import { getAssignmentWarnings } from '../services/assignmentAdvisor.service.js';

import mongoose from 'mongoose';

const ALLOWED_TASK_STATUSES = new Set(['todo', 'inprogress', 'review', 'done']);
const ALLOWED_WORKLOG_ACTIVITY_TYPES = new Set([
  'implementation',
  'testing',
  'code-review',
  'collaboration',
  'debugging',
  'planning',
  'documentation',
]);
const ALLOWED_WORKLOG_OUTCOMES = new Set(['progress', 'blocked', 'handoff', 'completed']);

const getUserIdString = (req) => (req.user?._id ? String(req.user._id) : null);

const toIdString = (value) =>
  value && typeof value.toString === 'function' ? value.toString() : String(value || '');

const normalizeAssigneesInput = (rawAssignees = [], fallbackAssignee = null) => {
  const list = Array.isArray(rawAssignees) ? rawAssignees : [];
  const deduped = [];
  const seen = new Set();

  for (const item of list) {
    const user = item?.user || item?._id || item;
    const userId = toIdString(user);
    if (!userId || userId === 'null' || userId === 'undefined' || seen.has(userId)) continue;
    seen.add(userId);

    const rawContribution = Number(item?.contributionPercent);
    const hasExplicit = Number.isFinite(rawContribution) && rawContribution >= 0;
    deduped.push({
      user,
      contributionPercent: hasExplicit ? rawContribution : null,
      _explicit: hasExplicit,
      assignedAt: item?.assignedAt || new Date(),
    });
  }

  const fallbackId = toIdString(fallbackAssignee);
  if (deduped.length === 0 && fallbackId && fallbackId !== 'null' && fallbackId !== 'undefined') {
    deduped.push({
      user: fallbackAssignee,
      contributionPercent: 100,
      _explicit: true,
      assignedAt: new Date(),
    });
  }

  if (deduped.length === 0) return [];

  const explicitTotal = deduped.reduce(
    (sum, a) => sum + (a._explicit ? Number(a.contributionPercent || 0) : 0),
    0
  );
  const implicitCount = deduped.filter((a) => !a._explicit).length;

  if (implicitCount > 0) {
    const remaining = Math.max(0, 100 - explicitTotal);
    const perImplicit = remaining / implicitCount;
    deduped.forEach((a) => {
      if (!a._explicit) a.contributionPercent = perImplicit;
    });
  }

  let total = deduped.reduce((sum, a) => sum + Number(a.contributionPercent || 0), 0);
  if (!Number.isFinite(total) || total <= 0) {
    const split = 100 / deduped.length;
    deduped.forEach((a) => {
      a.contributionPercent = split;
    });
    total = 100;
  }

  if (total > 100) {
    const scale = 100 / total;
    deduped.forEach((a) => {
      a.contributionPercent = Number((Number(a.contributionPercent || 0) * scale).toFixed(2));
    });
  }

  return deduped.map((a) => ({
    user: a.user,
    contributionPercent: Math.max(0, Math.min(100, Number(a.contributionPercent || 0))),
    assignedAt: a.assignedAt || new Date(),
  }));
};

const normalizeSubtasksInput = (rawSubtasks = []) => {
  if (!Array.isArray(rawSubtasks)) return [];

  const allowedStatus = new Set(['todo', 'inprogress', 'review', 'done']);
  const normalized = [];

  rawSubtasks.forEach((subtask, index) => {
    const title = String(subtask?.title || '').trim();
    if (!title) return;

    const status = String(subtask?.status || 'todo').toLowerCase();
    const storyPoints = Number(subtask?.storyPoints);
    const estimatedHours = Number(subtask?.estimatedHours);
    const actualHours = Number(subtask?.actualHours);

    normalized.push({
      ...(subtask?._id ? { _id: subtask._id } : {}),
      title,
      description: String(subtask?.description || ''),
      status: allowedStatus.has(status) ? status : 'todo',
      assignee: subtask?.assignee || null,
      storyPoints: Number.isFinite(storyPoints) && storyPoints >= 0 ? storyPoints : 0,
      estimatedHours: Number.isFinite(estimatedHours) && estimatedHours >= 0 ? estimatedHours : null,
      actualHours: Number.isFinite(actualHours) && actualHours >= 0 ? actualHours : 0,
      order: Number.isFinite(Number(subtask?.order)) ? Number(subtask.order) : index,
    });
  });

  return normalized;
};

const assigneeIdsFromTask = (task) => {
  const ids = new Set();

  if (task?.assignee) ids.add(toIdString(task.assignee));

  for (const a of task?.assignees || []) {
    if (a?.user) ids.add(toIdString(a.user));
  }

  for (const sub of task?.subtasks || []) {
    if (sub?.assignee) ids.add(toIdString(sub.assignee));
  }

  ids.delete('');
  ids.delete('null');
  ids.delete('undefined');
  return Array.from(ids);
};

const projectRoomIdFromTask = (populatedTask, fallbackProjectId) =>
  toIdString(populatedTask?.project?._id ?? populatedTask?.project ?? fallbackProjectId);

const emitTaskToProjectAndAssignees = (io, eventName, populatedTask, { fallbackProjectId = null, extraUserIds = [] } = {}) => {
  if (!io || !populatedTask) return;
  const projectId = projectRoomIdFromTask(populatedTask, fallbackProjectId);
  if (projectId) {
    io.to(`project:${projectId}`).emit(eventName, populatedTask);
  }
  const recipients = new Set([
    ...assigneeIdsFromTask(populatedTask),
    ...extraUserIds.map((id) => toIdString(id)).filter((id) => id && id !== 'null'),
  ]);
  recipients.forEach((uid) => {
    io.to(`user:${uid}`).emit(eventName, populatedTask);
  });
};

const taskHasAssignee = (task, userId) => {
  if (!userId) return false;
  return assigneeIdsFromTask(task).includes(String(userId));
};

const queueBurnoutRefreshForUserIds = (userIds = []) => {
  const deduped = Array.from(
    new Set(
      userIds
        .map((id) => toIdString(id))
        .filter((id) => id && id !== 'null' && id !== 'undefined')
    )
  );

  deduped.forEach((id) => queueUserAiBurnoutRefresh(id));
};

const queueBurnoutRefreshForTask = (task, extraUserIds = []) => {
  const fromTask = assigneeIdsFromTask(task);
  queueBurnoutRefreshForUserIds([...fromTask, ...extraUserIds]);
};

const parseDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isCompletedSprintStatus = (status) => String(status || '').toLowerCase() === 'completed';

const ensureTaskSprintMutable = async (
  res,
  task,
  message = 'This task belongs to a completed sprint and is read-only'
) => {
  if (!task?.sprint) return true;

  const sprint = await Sprint.findById(task.sprint).select('status').lean();
  if (!sprint) return true;

  if (isCompletedSprintStatus(sprint.status)) {
    apiResponse(res, 409, false, null, message);
    return false;
  }

  return true;
};

const normalizeObjectIdArrayInput = (rawValues = []) => {
  const values = Array.isArray(rawValues) ? rawValues : [];
  const ids = [];
  const invalidIds = [];
  const seen = new Set();

  for (const value of values) {
    const candidate = value && typeof value === 'object' && value._id ? value._id : value;
    const id = toIdString(candidate);
    if (!id || id === 'null' || id === 'undefined') continue;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      invalidIds.push(id);
      continue;
    }

    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return { ids, invalidIds };
};

const createsBlockedByCycle = async ({ taskId, initialBlockerIds = [] }) => {
  const targetId = toIdString(taskId);
  if (!targetId) return false;

  const queue = Array.from(
    new Set(
      initialBlockerIds
        .map((id) => toIdString(id))
        .filter((id) => id && id !== 'null' && id !== 'undefined')
    )
  );

  const visited = new Set(queue);

  while (queue.length > 0) {
    const batch = queue.splice(0, 100);
    const tasks = await Task.find({ _id: { $in: batch } }).select('_id blockedBy').lean();

    for (const currentTask of tasks) {
      const blockers = Array.isArray(currentTask?.blockedBy)
        ? currentTask.blockedBy
            .map((id) => toIdString(id))
            .filter((id) => id && id !== 'null' && id !== 'undefined')
        : [];

      for (const blockerId of blockers) {
        if (blockerId === targetId) {
          return true;
        }

        if (!visited.has(blockerId)) {
          visited.add(blockerId);
          queue.push(blockerId);
        }
      }
    }
  }

  return false;
};

const validateBlockedByIds = async ({ taskId = null, projectId, blockedByIds = [] }) => {
  const normalizedTaskId = taskId ? toIdString(taskId) : null;
  const normalizedProjectId = toIdString(projectId);

  if (normalizedTaskId && blockedByIds.includes(normalizedTaskId)) {
    return {
      ok: false,
      status: 400,
      message: 'Task cannot be blocked by itself',
    };
  }

  if (blockedByIds.length === 0) {
    return { ok: true };
  }

  const blockerTasks = await Task.find({ _id: { $in: blockedByIds } })
    .select('_id project blockedBy')
    .lean();

  const foundIdSet = new Set(blockerTasks.map((task) => toIdString(task._id)));
  const missingIds = blockedByIds.filter((id) => !foundIdSet.has(id));
  if (missingIds.length > 0) {
    return {
      ok: false,
      status: 400,
      message: `One or more blocker tasks do not exist (${missingIds.slice(0, 3).join(', ')})`,
    };
  }

  const crossProject = blockerTasks.find((blockerTask) => toIdString(blockerTask.project) !== normalizedProjectId);
  if (crossProject) {
    return {
      ok: false,
      status: 400,
      message: 'Blocker tasks must belong to the same project',
    };
  }

  if (normalizedTaskId) {
    const hasCycle = await createsBlockedByCycle({
      taskId: normalizedTaskId,
      initialBlockerIds: blockedByIds,
    });

    if (hasCycle) {
      return {
        ok: false,
        status: 400,
        message: 'Circular blocker dependency detected',
      };
    }
  }

  return { ok: true };
};

const findActiveTimerIndex = (task, userId) => {
  const uid = toIdString(userId);
  const timers = Array.isArray(task?.activeTimers) ? task.activeTimers : [];
  return timers.findIndex((entry) => toIdString(entry?.user) === uid);
};

const autoStopTimerForStatusTransition = ({ task, userId, newStatus, stopAll = false }) => {
  const timers = Array.isArray(task?.activeTimers) ? task.activeTimers : [];
  if (!timers.length) return;

  const uid = toIdString(userId);
  const endedAt = new Date();
  const remainingTimers = [];

  for (const timer of timers) {
    const timerUserId = toIdString(timer?.user);
    const shouldStop = stopAll || (uid && timerUserId === uid);

    if (!shouldStop) {
      remainingTimers.push(timer);
      continue;
    }

    const startedAt = parseDateOrNull(timer?.startedAt) || endedAt;
    const rawHours = Math.max(0.01, (endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60));
    const cappedHours = Math.min(rawHours, 24);

    task.worklogs.push({
      user: timer?.user || userId,
      hours: Number(cappedHours.toFixed(2)),
      date: endedAt,
      startedAt,
      endedAt,
      source: 'time-range',
      activityType: timer?.activityType || 'implementation',
      outcome: newStatus === 'done' ? 'completed' : 'handoff',
      progressDelta: null,
      description:
        rawHours > 24
          ? `Auto-logged from active timer during status change to ${newStatus} (duration capped at 24h)`
          : `Auto-logged from active timer during status change to ${newStatus}`,
    });
  }

  task.activeTimers = remainingTimers;
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

const ensureTaskAccess = async (req, res, task, { allowAssignee = true } = {}) => {
  if (req.user.role === 'admin') return true;

  const userId = getUserIdString(req);
  const projectIds = await getAccessibleProjectIdSet(req);
  const isInAccessibleProject = projectIds.has(String(task.project));
  const isAssignee = allowAssignee && taskHasAssignee(task, userId);

  if (!isInAccessibleProject && !isAssignee) {
    apiResponse(res, 403, false, null, 'Not authorized for this task');
    return false;
  }

  return true;
};

export const getTasks = async (req, res) => {
  const { sprintId, projectId, assigneeId } = req.query;

  let query = {};
  
  if (req.user.role !== 'admin') {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const userProjects = await Project.find({
      $or: [{ owner: userId }, { 'members.user': userId }]
    }).select('_id');
    const allowedIds = userProjects.map(p => p._id.toString());

    if (projectId && !allowedIds.includes(projectId)) {
      // If querying a specific project but not a member, ONLY allow if they are assigned to this project's tasks
      query.project = projectId;
      query.$or = [
        { assignee: userId },
        { 'assignees.user': userId },
        { 'subtasks.assignee': userId },
      ];
    } else {
      // Allowed projects OR expressly assigned tasks
      query.$or = [
        { project: projectId ? projectId : { $in: allowedIds } },
        { assignee: userId },
        { 'assignees.user': userId },
        { 'subtasks.assignee': userId },
      ];
    }
  } else if (projectId) {
    query.project = projectId;
  }

  if (sprintId) {
    query.sprint = sprintId === 'backlog' ? null : sprintId;
  }
  
  if (assigneeId) {
    if (!query.$and) query.$and = [];
    query.$and.push({
      $or: [
        { assignee: assigneeId },
        { 'assignees.user': assigneeId },
        { 'subtasks.assignee': assigneeId },
      ],
    });
  }

  const tasks = await Task.find(query)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('worklogs.user', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar')
    .sort({ order: 1, createdAt: -1 });

  apiResponse(res, 200, true, tasks, 'Tasks fetched successfully');
};

export const previewAssignmentWarnings = async (req, res) => {
  const payload = req.body || {};

  const projectId = payload.projectId || null;
  const sprintId = payload.sprintId || null;

  if (req.user.role !== 'admin' && projectId) {
    const accessibleProjectIds = await getAccessibleProjectIdSet(req);
    if (!accessibleProjectIds.has(String(projectId))) {
      return apiResponse(res, 403, false, null, 'Not authorized for this project');
    }
  }

  const assigneeSource = Array.isArray(payload.assignees)
    ? payload.assignees
    : Array.isArray(payload.assigneeIds)
      ? payload.assigneeIds
      : [];

  const normalizedAssignees = normalizeAssigneesInput(assigneeSource, payload.assignee || null);
  const assigneeIds = normalizedAssignees.map((a) => toIdString(a.user));

  let incomingStoryPoints = Number(payload.storyPoints);
  if (!Number.isFinite(incomingStoryPoints) || incomingStoryPoints < 0) {
    incomingStoryPoints = 0;
  }

  const normalizedSubtasks = normalizeSubtasksInput(payload.subtasks);
  if (normalizedSubtasks.length > 0) {
    const subtaskPoints = normalizedSubtasks.reduce((sum, s) => sum + Number(s.storyPoints || 0), 0);
    if (subtaskPoints > 0) incomingStoryPoints = subtaskPoints;
  }

  const contributionMap = {};
  if (normalizedAssignees.length > 0) {
    normalizedAssignees.forEach((a) => {
      contributionMap[toIdString(a.user)] = Number(a.contributionPercent || 0);
    });
  }

  const result = await getAssignmentWarnings({
    assigneeIds,
    projectId,
    sprintId,
    incomingStoryPoints,
    incomingContributionByUser: contributionMap,
  });

  apiResponse(res, 200, true, result, 'Assignment warning analysis complete');
};

export const createTask = async (req, res) => {
  console.log('CREATE TASK REQUEST BODY:', req.body, 'USER ID:', req.user?._id);
  
  const payload = { ...req.body, reporter: req.user._id };
  payload.assignees = normalizeAssigneesInput(payload.assignees, payload.assignee);
  payload.assignee = payload.assignees.length > 0 ? payload.assignees[0].user : null;
  if (Object.prototype.hasOwnProperty.call(payload, 'subtasks')) {
    payload.subtasks = normalizeSubtasksInput(payload.subtasks);
  }

  if (payload.storyPoints !== undefined && payload.storyPoints !== null && payload.storyPoints !== '') {
    const storyPoints = Number(payload.storyPoints);
    if (!Number.isFinite(storyPoints) || storyPoints < 0 || storyPoints > 13) {
      return apiResponse(res, 400, false, null, 'Story points must be between 0 and 13');
    }
    payload.storyPoints = storyPoints;
  }

  let accessibleProjectIds = null;

  if (req.user.role !== 'admin') {
    if (!payload.project) {
      return apiResponse(res, 400, false, null, 'project is required');
    }
    accessibleProjectIds = await getAccessibleProjectIdSet(req);
    if (!accessibleProjectIds.has(String(payload.project))) {
      return apiResponse(res, 403, false, null, 'Not authorized for this project');
    }
  }

  if (payload.sprint) {
    const sprint = await Sprint.findById(payload.sprint).select('projectId status');
    if (!sprint) {
      return apiResponse(res, 400, false, null, 'Sprint not found');
    }
    if (isCompletedSprintStatus(sprint.status)) {
      return apiResponse(res, 409, false, null, 'Cannot add tasks to a completed sprint');
    }
    if (String(sprint.projectId) !== String(payload.project)) {
      return apiResponse(res, 400, false, null, 'Task and sprint must belong to the same project');
    }
    if (req.user.role !== 'admin' && !accessibleProjectIds.has(String(sprint.projectId))) {
      return apiResponse(res, 403, false, null, 'Not authorized for this sprint');
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'blockedBy')) {
    if (!Array.isArray(payload.blockedBy)) {
      return apiResponse(res, 400, false, null, 'blockedBy must be an array of task IDs');
    }

    const { ids: blockedByIds, invalidIds } = normalizeObjectIdArrayInput(payload.blockedBy);
    if (invalidIds.length > 0) {
      return apiResponse(
        res,
        400,
        false,
        null,
        `Invalid blocker task ID(s): ${invalidIds.slice(0, 3).join(', ')}`
      );
    }

    const blockerValidation = await validateBlockedByIds({
      projectId: payload.project,
      blockedByIds,
    });

    if (!blockerValidation.ok) {
      return apiResponse(res, blockerValidation.status, false, null, blockerValidation.message);
    }

    payload.blockedBy = blockedByIds;
  }

  if (payload.assignees.length > 0) {
    payload.assignedAt = new Date();
  }
  if (payload.sprint) {
    payload.addedToSprintAt = new Date();
  }

  const task = await Task.create(payload);

  if (task.sprint) {
    // await Sprint.findByIdAndUpdate(task.sprint, { $push: { tasks: task._id } });
  }

  const populatedNew = await Task.findById(task._id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar');

  const ioCreate = req.app.get('io');
  if (ioCreate) {
    emitTaskToProjectAndAssignees(ioCreate, 'task:updated', populatedNew, { fallbackProjectId: task.project });
  }

  queueTaskAiEffortRefresh(task._id);
  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task);

  apiResponse(res, 201, true, populatedNew, 'Task created successfully');
};

export const getTaskById = async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar')
    .populate('statusHistory.changedBy', 'name email avatar role')
    .populate('comments.user', 'name avatar')
    .populate('worklogs.user', 'name avatar');

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  apiResponse(res, 200, true, task, 'Task fetched successfully');
};

export const updateTask = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: false }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  const previousAssigneeIds = assigneeIdsFromTask(task);

  const hasAssigneePatch =
    Object.prototype.hasOwnProperty.call(req.body, 'assignee') ||
    Object.prototype.hasOwnProperty.call(req.body, 'assignees');

  if (hasAssigneePatch) {
    const fallbackAssignee = Object.prototype.hasOwnProperty.call(req.body, 'assignee')
      ? req.body.assignee
      : task.assignee;
    const sourceAssignees = Object.prototype.hasOwnProperty.call(req.body, 'assignees')
      ? req.body.assignees
      : task.assignees;

    const normalizedAssignees = normalizeAssigneesInput(sourceAssignees, fallbackAssignee);
    req.body.assignees = normalizedAssignees;
    req.body.assignee = normalizedAssignees.length > 0 ? normalizedAssignees[0].user : null;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'subtasks')) {
    req.body.subtasks = normalizeSubtasksInput(req.body.subtasks);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'blockedBy')) {
    if (req.body.blockedBy == null) {
      req.body.blockedBy = [];
    }

    if (!Array.isArray(req.body.blockedBy)) {
      return apiResponse(res, 400, false, null, 'blockedBy must be an array of task IDs');
    }

    const { ids: blockedByIds, invalidIds } = normalizeObjectIdArrayInput(req.body.blockedBy);
    if (invalidIds.length > 0) {
      return apiResponse(
        res,
        400,
        false,
        null,
        `Invalid blocker task ID(s): ${invalidIds.slice(0, 3).join(', ')}`
      );
    }

    const blockerValidation = await validateBlockedByIds({
      taskId: task._id,
      projectId: task.project,
      blockedByIds,
    });

    if (!blockerValidation.ok) {
      return apiResponse(res, blockerValidation.status, false, null, blockerValidation.message);
    }

    req.body.blockedBy = blockedByIds;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'sprint') && req.body.sprint) {
    const targetSprint = await Sprint.findById(req.body.sprint).select('projectId status');
    if (!targetSprint) {
      return apiResponse(res, 400, false, null, 'Sprint not found');
    }
    if (isCompletedSprintStatus(targetSprint.status)) {
      return apiResponse(res, 409, false, null, 'Cannot move tasks into a completed sprint');
    }
    if (String(targetSprint.projectId) !== String(task.project)) {
      return apiResponse(res, 400, false, null, 'Task and sprint must belong to the same project');
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'storyPoints')) {
    if (req.body.storyPoints === '' || req.body.storyPoints === null) {
      req.body.storyPoints = 0;
    }
    const storyPoints = Number(req.body.storyPoints);
    if (!Number.isFinite(storyPoints) || storyPoints < 0 || storyPoints > 13) {
      return apiResponse(res, 400, false, null, 'Story points must be between 0 and 13');
    }
    req.body.storyPoints = storyPoints;
  }

  // Track assignedAt when assignee changes
  if (Object.prototype.hasOwnProperty.call(req.body, 'assignee')) {
    const nextAssignee = req.body.assignee ? String(req.body.assignee) : null;
    const currentAssignee = task.assignee ? String(task.assignee) : null;
    if (nextAssignee !== currentAssignee) {
      req.body.assignedAt = new Date();
    }
  }

  // Track churn counters for key fields
  if (!task.changeCounters) {
    task.changeCounters = {};
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'priority') && req.body.priority !== task.priority) {
    task.changeCounters.priorityChanges = (task.changeCounters.priorityChanges || 0) + 1;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'description') && req.body.description !== task.description) {
    task.changeCounters.descriptionChanges = (task.changeCounters.descriptionChanges || 0) + 1;
  }

  // Apply updates
  const touchesEffortInputs =
    Object.prototype.hasOwnProperty.call(req.body, 'title') ||
    Object.prototype.hasOwnProperty.call(req.body, 'description') ||
    Object.prototype.hasOwnProperty.call(req.body, 'priority') ||
    Object.prototype.hasOwnProperty.call(req.body, 'type');

  Object.assign(task, req.body);
  task.lastActivityAt = new Date();
  await task.save();

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar');

  const io = req.app.get('io');
  if (io) {
    emitTaskToProjectAndAssignees(io, 'task:updated', populated, {
      fallbackProjectId: task.project,
      extraUserIds: previousAssigneeIds,
    });
  }

  if (touchesEffortInputs) {
    queueTaskAiEffortRefresh(task._id);
  }
  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task, previousAssigneeIds);

  apiResponse(res, 200, true, populated, 'Task updated successfully');
};

export const deleteTask = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: false }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  if (task.sprint) {
    // await Sprint.findByIdAndUpdate(task.sprint, { $pull: { tasks: task._id } });
  }

  await Task.findByIdAndDelete(req.params.id);

  apiResponse(res, 200, true, null, 'Task deleted successfully');
};

export const updateTaskStatus = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  const oldStatus = String(task.status || '').toLowerCase();
  const newStatus = String(req.body.status || '').toLowerCase();

  if (!ALLOWED_TASK_STATUSES.has(newStatus)) {
    return apiResponse(res, 400, false, null, 'Invalid task status');
  }

  if (newStatus === oldStatus) {
    const unchanged = await Task.findById(task._id)
      .populate('assignee', 'name avatar')
      .populate('assignees.user', 'name avatar role')
      .populate('subtasks.assignee', 'name avatar')
      .populate('reporter', 'name avatar')
      .populate('statusHistory.changedBy', 'name email avatar role');
    return apiResponse(res, 200, true, unchanged, 'Task status unchanged');
  }

  const requesterRole = String(req.user?.role || '').toLowerCase();
  if (requesterRole === 'developer' && newStatus !== 'inprogress') {
    return apiResponse(
      res,
      409,
      false,
      null,
      'Developers must use Stop Timer & Log to move tasks to Review, Done, or Todo'
    );
  }

  const activeTimers = Array.isArray(task.activeTimers) ? task.activeTimers : [];
  if (activeTimers.length > 0 && newStatus !== 'inprogress') {
    return apiResponse(
      res,
      409,
      false,
      null,
      'Stop active timers via Stop & Log before moving this task out of In Progress'
    );
  }

  if (
    String(req.user?.role || '').toLowerCase() === 'developer' &&
    oldStatus !== 'inprogress' &&
    newStatus === 'inprogress' &&
    findActiveTimerIndex(task, req.user._id) < 0
  ) {
    return apiResponse(
      res,
      409,
      false,
      null,
      'Developers must start a work timer to move a task to In Progress'
    );
  }

  // Push to statusHistory
  task.statusHistory.push({
    from: oldStatus,
    to: newStatus,
    changedBy: req.user._id,
    changedAt: new Date(),
  });

  // Set lifecycle timestamps
  if (newStatus === 'inprogress' && !task.startedAt) {
    task.startedAt = new Date();
  }
  if (newStatus === 'done') {
    task.completedAt = new Date();
    if (task.sprint) {
      queueSprintAiRiskRefresh(task.sprint);
    }
  }
  if (oldStatus === 'done' && newStatus !== 'done') {
    task.reopenedAt = new Date();
    task.completedAt = null; // Clear completion since it's reopened
  }

  task.status = newStatus;
  task.lastActivityAt = new Date();
  await task.save();

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar')
    .populate('statusHistory.changedBy', 'name email avatar role');

  const io = req.app.get('io');
  if (io) {
    emitTaskToProjectAndAssignees(io, 'task:moved', populated, { fallbackProjectId: task.project });
  }

  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task);

  apiResponse(res, 200, true, populated, 'Task status updated');
};

export const updateTaskSprint = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: false }))) {
    return;
  }

  const taskAssigneeIds = assigneeIdsFromTask(task);

  const oldSprint = task.sprint;
  const newSprint = req.body.sprintId;

  if (oldSprint) {
    const currentSprint = await Sprint.findById(oldSprint).select('status').lean();
    if (currentSprint && isCompletedSprintStatus(currentSprint.status)) {
      return apiResponse(res, 409, false, null, 'Completed sprint tasks are read-only and cannot be moved');
    }
  }

  if (newSprint) {
    const sprint = await Sprint.findById(newSprint).select('projectId status');
    if (!sprint) {
      return apiResponse(res, 404, false, null, 'Target sprint not found');
    }
    if (isCompletedSprintStatus(sprint.status)) {
      return apiResponse(res, 409, false, null, 'Cannot move tasks into a completed sprint');
    }
    if (String(sprint.projectId) !== String(task.project)) {
      return apiResponse(res, 400, false, null, 'Task and sprint must belong to the same project');
    }
  }

  task.sprint = newSprint || null;
  if (newSprint && newSprint !== oldSprint?.toString()) {
    task.addedToSprintAt = new Date();
  }
  await task.save();

  if (oldSprint) {
    // await Sprint.findByIdAndUpdate(oldSprint, { $pull: { tasks: task._id } });
  }

  if (newSprint) {
    // await Sprint.findByIdAndUpdate(newSprint, { $push: { tasks: task._id } });
  }

  if (oldSprint) {
    queueSprintAiRiskRefresh(oldSprint);
  }
  if (newSprint) {
    queueSprintAiRiskRefresh(newSprint);
  }
  queueTaskAiEffortRefresh(task._id);
  queueBurnoutRefreshForUserIds(taskAssigneeIds);

  const populatedSprintMove = await Task.findById(task._id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('reporter', 'name avatar');

  const ioSprint = req.app.get('io');
  if (ioSprint) {
    emitTaskToProjectAndAssignees(ioSprint, 'task:updated', populatedSprintMove, {
      fallbackProjectId: task.project,
      extraUserIds: taskAssigneeIds,
    });
  }

  apiResponse(res, 200, true, populatedSprintMove, 'Task sprint updated');
};

export const reorderTask = async (req, res) => {
  const { order } = req.body;
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: false }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  task.order = order;
  await task.save();

  apiResponse(res, 200, true, task, 'Task reordered');
};

export const addComment = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  const comment = {
    user: req.user._id,
    text: req.body.text,
  };

  task.comments.push(comment);
  await task.save();

  const populatedTask = await Task.findById(task._id).populate('comments.user', 'name avatar');
  const addedComment = populatedTask.comments[populatedTask.comments.length - 1];

  const io = req.app.get('io');
  if (io) {
    io.to(`task:${task._id}`).emit('comment:added', addedComment);
  }

  apiResponse(res, 200, true, addedComment, 'Comment added');
};

export const deleteComment = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  const comment = task.comments.id(req.params.cid);
  
  if (!comment) {
    return apiResponse(res, 404, false, null, 'Comment not found');
  }

  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return apiResponse(res, 403, false, null, 'Unauthorized to delete this comment');
  }

  task.comments.pull(req.params.cid);
  await task.save();

  apiResponse(res, 200, true, null, 'Comment deleted');
};

export const addWorklog = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  const startedAt = parseDateOrNull(req.body.startedAt);
  const endedAt = parseDateOrNull(req.body.endedAt);

  if ((req.body.startedAt && !startedAt) || (req.body.endedAt && !endedAt)) {
    return apiResponse(res, 400, false, null, 'Invalid worklog start or end time');
  }

  if ((startedAt && !endedAt) || (!startedAt && endedAt)) {
    return apiResponse(res, 400, false, null, 'Provide both start and end time for range-based logs');
  }

  let hours = Number(req.body.hours);
  if ((!Number.isFinite(hours) || hours <= 0) && startedAt && endedAt) {
    hours = (endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    return apiResponse(res, 400, false, null, 'Worklog hours must be greater than 0');
  }

  if (hours > 24) {
    return apiResponse(res, 400, false, null, 'Single worklog entry cannot exceed 24 hours');
  }

  if (startedAt && endedAt && endedAt <= startedAt) {
    return apiResponse(res, 400, false, null, 'Worklog end time must be after start time');
  }

  const activityType = String(req.body.activityType || 'implementation').toLowerCase();
  if (!ALLOWED_WORKLOG_ACTIVITY_TYPES.has(activityType)) {
    return apiResponse(res, 400, false, null, 'Invalid worklog activity type');
  }

  const outcome = String(req.body.outcome || 'progress').toLowerCase();
  if (!ALLOWED_WORKLOG_OUTCOMES.has(outcome)) {
    return apiResponse(res, 400, false, null, 'Invalid worklog outcome');
  }

  const description = String(req.body.description || '').trim();
  if (description.length < 5) {
    return apiResponse(res, 400, false, null, 'Worklog description must be at least 5 characters');
  }

  let progressDelta = null;
  const hasProgressDelta =
    req.body.progressDelta !== undefined &&
    req.body.progressDelta !== null &&
    String(req.body.progressDelta).trim() !== '';

  if (hasProgressDelta) {
    progressDelta = Number(req.body.progressDelta);
    if (!Number.isFinite(progressDelta) || progressDelta < -100 || progressDelta > 100) {
      return apiResponse(res, 400, false, null, 'Progress delta must be between -100 and 100');
    }
  }

  const entryDate = parseDateOrNull(req.body.date) || endedAt || new Date();

  const worklog = {
    user: req.user._id,
    hours: Number(hours.toFixed(2)),
    date: entryDate,
    startedAt,
    endedAt,
    source: startedAt && endedAt ? 'time-range' : 'manual-hours',
    activityType,
    outcome,
    progressDelta,
    description,
  };

  task.worklogs.push(worklog);
  await task.save(); // pre-save hook will update actualHours

  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task);

  apiResponse(res, 200, true, task, 'Worklog added');
};

export const deleteWorklog = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  const worklog = task.worklogs.id(req.params.wid);
  
  if (!worklog) {
    return apiResponse(res, 404, false, null, 'Worklog not found');
  }

  if (worklog.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return apiResponse(res, 403, false, null, 'Unauthorized to delete this worklog');
  }

  task.worklogs.pull(req.params.wid);
  await task.save(); // pre-save hook will recalculate actualHours

  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task);

  apiResponse(res, 200, true, task, 'Worklog deleted');
};

export const startWorklogTimer = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  if (findActiveTimerIndex(task, req.user._id) >= 0) {
    return apiResponse(res, 400, false, null, 'You already have an active timer for this task');
  }

  const activityType = String(req.body.activityType || 'implementation').toLowerCase();
  if (!ALLOWED_WORKLOG_ACTIVITY_TYPES.has(activityType)) {
    return apiResponse(res, 400, false, null, 'Invalid worklog activity type');
  }

  const startedAt = parseDateOrNull(req.body.startedAt) || new Date();

  task.activeTimers.push({
    user: req.user._id,
    startedAt,
    activityType,
    note: String(req.body.note || '').trim(),
  });

  const oldStatus = String(task.status || '').toLowerCase();
  if (oldStatus !== 'inprogress') {
    task.statusHistory.push({
      from: oldStatus,
      to: 'inprogress',
      changedBy: req.user._id,
      changedAt: new Date(),
    });
    task.status = 'inprogress';
    task.startedAt = task.startedAt || new Date();

    if (oldStatus === 'done') {
      task.reopenedAt = new Date();
      task.completedAt = null;
    }
  }

  task.lastActivityAt = new Date();
  await task.save();

  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task);

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar')
    .populate('statusHistory.changedBy', 'name email avatar role');

  apiResponse(res, 200, true, populated, 'Work timer started');
};

export const stopWorklogTimer = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureTaskAccess(req, res, task, { allowAssignee: true }))) {
    return;
  }

  if (!(await ensureTaskSprintMutable(res, task))) {
    return;
  }

  const timerIndex = findActiveTimerIndex(task, req.user._id);
  if (timerIndex < 0) {
    return apiResponse(res, 400, false, null, 'No active timer found for this task');
  }

  const timer = task.activeTimers[timerIndex];
  const rawRequestedStatus = req.body.status;
  if (rawRequestedStatus === undefined || rawRequestedStatus === null || String(rawRequestedStatus).trim() === '') {
    return apiResponse(res, 400, false, null, 'Status after stop is required');
  }

  const requestedStatus = String(rawRequestedStatus).toLowerCase();
  if (!ALLOWED_TASK_STATUSES.has(requestedStatus)) {
    return apiResponse(res, 400, false, null, 'Invalid task status');
  }

  const remainingActiveTimerCount = Math.max(0, task.activeTimers.length - 1);
  if (requestedStatus !== 'inprogress' && remainingActiveTimerCount > 0) {
    return apiResponse(
      res,
      409,
      false,
      null,
      'Other collaborators still have active timers. Keep status In Progress until all timers are stopped'
    );
  }

  let startedAt = parseDateOrNull(req.body.startedAt) || parseDateOrNull(timer?.startedAt) || new Date();
  let endedAt = parseDateOrNull(req.body.endedAt) || new Date();

  const manualHours = Number(req.body.hours);
  const hasManualHours = Number.isFinite(manualHours) && manualHours > 0;

  let durationHours = (endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

  if (hasManualHours) {
    if (manualHours > 24) {
      return apiResponse(res, 400, false, null, 'Timer duration must be between 0 and 24 hours');
    }
    durationHours = manualHours;
    startedAt = new Date(endedAt.getTime() - durationHours * 60 * 60 * 1000);
  }

  if (!hasManualHours && endedAt <= startedAt) {
    endedAt = new Date(startedAt.getTime() + 60 * 1000);
    durationHours = (endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
  }

  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 24) {
    return apiResponse(res, 400, false, null, 'Timer duration must be between 0 and 24 hours');
  }

  const activityType = String(req.body.activityType || timer?.activityType || 'implementation').toLowerCase();
  if (!ALLOWED_WORKLOG_ACTIVITY_TYPES.has(activityType)) {
    return apiResponse(res, 400, false, null, 'Invalid worklog activity type');
  }

  const outcome = String(req.body.outcome || 'progress').toLowerCase();
  if (!ALLOWED_WORKLOG_OUTCOMES.has(outcome)) {
    return apiResponse(res, 400, false, null, 'Invalid worklog outcome');
  }

  const description = String(req.body.description || '').trim();
  if (description.length < 5) {
    return apiResponse(res, 400, false, null, 'Worklog description must be at least 5 characters');
  }

  let progressDelta = null;
  const hasProgressDelta =
    req.body.progressDelta !== undefined &&
    req.body.progressDelta !== null &&
    String(req.body.progressDelta).trim() !== '';

  if (hasProgressDelta) {
    progressDelta = Number(req.body.progressDelta);
    if (!Number.isFinite(progressDelta) || progressDelta < -100 || progressDelta > 100) {
      return apiResponse(res, 400, false, null, 'Progress delta must be between -100 and 100');
    }
  }

  task.worklogs.push({
    user: req.user._id,
    hours: Number(durationHours.toFixed(2)),
    date: endedAt,
    startedAt,
    endedAt,
    source: 'time-range',
    activityType,
    outcome,
    progressDelta,
    description,
  });

  task.activeTimers.splice(timerIndex, 1);

  if (requestedStatus !== task.status) {
    const oldStatus = String(task.status || '').toLowerCase();
    task.statusHistory.push({
      from: oldStatus,
      to: requestedStatus,
      changedBy: req.user._id,
      changedAt: new Date(),
    });

    if (requestedStatus === 'inprogress' && !task.startedAt) {
      task.startedAt = new Date();
    }
    if (requestedStatus === 'done') {
      task.completedAt = new Date();
    }
    if (oldStatus === 'done' && requestedStatus !== 'done') {
      task.reopenedAt = new Date();
      task.completedAt = null;
    }

    task.status = requestedStatus;
  }

  task.lastActivityAt = new Date();
  await task.save();

  if (task.sprint) {
    queueSprintAiRiskRefresh(task.sprint);
  }
  queueBurnoutRefreshForTask(task);

  const populated = await Task.findById(task._id)
    .populate('assignee', 'name avatar')
    .populate('assignees.user', 'name avatar role')
    .populate('subtasks.assignee', 'name avatar')
    .populate('activeTimers.user', 'name avatar')
    .populate('reporter', 'name avatar')
    .populate('statusHistory.changedBy', 'name email avatar role');

  apiResponse(res, 200, true, populated, 'Work timer stopped and log recorded');
};
