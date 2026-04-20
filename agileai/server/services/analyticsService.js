import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import Project from '../models/Project.model.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function safeNumber(n) {
  return Number.isFinite(n) ? n : 0;
}

function toIdString(value) {
  return value && typeof value.toString === 'function' ? value.toString() : String(value || '');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function taskAssignedToUser(task, userId) {
  const uid = toIdString(userId);
  if (!uid) return false;

  if (task?.assignee && toIdString(task.assignee) === uid) return true;

  if (Array.isArray(task?.assignees) && task.assignees.some((entry) => toIdString(entry?.user) === uid)) {
    return true;
  }

  if (Array.isArray(task?.subtasks) && task.subtasks.some((sub) => toIdString(sub?.assignee) === uid)) {
    return true;
  }

  return false;
}

function getWorklogHours(task, userId) {
  const uid = toIdString(userId);
  const logs = Array.isArray(task?.worklogs) ? task.worklogs : [];

  let totalHours = 0;
  let userHours = 0;

  for (const log of logs) {
    const hours = safeNumber(Number(log?.hours || 0));
    if (hours <= 0) continue;

    totalHours += hours;

    if (toIdString(log?.user) === uid) {
      userHours += hours;
    }
  }

  return { totalHours, userHours };
}

function taskPointsForUser(task, userId, { preferWorklogs = false } = {}) {
  const uid = toIdString(userId);
  const storyPoints = safeNumber(Number(task?.storyPoints || 0));

  if (Array.isArray(task?.subtasks) && task.subtasks.length > 0) {
    const subtaskPoints = task.subtasks
      .filter((sub) => toIdString(sub?.assignee) === uid)
      .reduce((sum, sub) => sum + safeNumber(Number(sub?.storyPoints || 0)), 0);
    if (subtaskPoints > 0) return subtaskPoints;
  }

  if (preferWorklogs && storyPoints > 0) {
    const { totalHours, userHours } = getWorklogHours(task, uid);
    if (totalHours > 0) {
      if (userHours <= 0) return 0;
      return storyPoints * (userHours / totalHours);
    }
  }

  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    const matched = task.assignees.find((entry) => toIdString(entry?.user) === uid);
    if (matched) {
      const pct = Number(matched?.contributionPercent);
      if (Number.isFinite(pct) && pct > 0) {
        return storyPoints * (pct / 100);
      }
      return storyPoints / task.assignees.length;
    }
  }

  if (task?.assignee && toIdString(task.assignee) === uid) {
    return storyPoints;
  }

  if (preferWorklogs && storyPoints > 0) {
    const history = Array.isArray(task?.statusHistory) ? task.statusHistory : [];
    const doneTransition = [...history]
      .reverse()
      .find((entry) => String(entry?.to || '').toLowerCase() === 'done');

    if (doneTransition?.changedBy) {
      return toIdString(doneTransition.changedBy) === uid ? storyPoints : 0;
    }
  }

  return 0;
}

function activeTaskResponsibilityWeight(task, userId) {
  const uid = toIdString(userId);
  if (!uid) return 0;

  if (!taskAssignedToUser(task, uid)) return 0;

  const logs = Array.isArray(task?.worklogs) ? task.worklogs : [];
  const totalHours = logs.reduce((sum, log) => sum + safeNumber(Number(log?.hours || 0)), 0);

  // FIX: If ANY worklogs exist on the task, use worklog-proportional allocation.
  // Do NOT fall through to equal-split if worklogs exist but this user logged 0h.
  // A co-assignee with 0h logged gets 0 weight — they earned no credit.
  if (totalHours > 0) {
    const userHours = logs.reduce((sum, log) => {
      if (toIdString(log?.user) !== uid) return sum;
      return sum + safeNumber(Number(log?.hours || 0));
    }, 0);
    // userHours=0 correctly returns 0 (no credit for no work)
    return Math.max(0, Math.min(1, userHours / totalHours));
  }

  // No worklogs on task at all — fall back to contributionPercent or equal-split
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    const matched = task.assignees.find((entry) => toIdString(entry?.user) === uid);
    if (matched) {
      const pct = Number(matched?.contributionPercent);
      if (Number.isFinite(pct) && pct > 0) {
        return Math.max(0, Math.min(1, pct / 100));
      }
      return 1 / task.assignees.length;
    }
  }

  if (task?.assignee && toIdString(task.assignee) === uid) {
    return 1;
  }

  return 0;
}

function resolveTaskCompletedAt(task) {
  if (task?.completedAt) {
    const completedAt = new Date(task.completedAt);
    if (!Number.isNaN(completedAt.getTime())) {
      return completedAt;
    }
  }

  const history = Array.isArray(task?.statusHistory) ? task.statusHistory : [];
  const doneTransition = [...history]
    .reverse()
    .find((entry) => String(entry?.to || '').toLowerCase() === 'done');

  if (doneTransition?.changedAt) {
    const changedAt = new Date(doneTransition.changedAt);
    if (!Number.isNaN(changedAt.getTime())) {
      return changedAt;
    }
  }

  if (String(task?.status || '').toLowerCase() === 'done' && task?.updatedAt) {
    const updatedAt = new Date(task.updatedAt);
    if (!Number.isNaN(updatedAt.getTime())) {
      return updatedAt;
    }
  }

  return null;
}

function computeBurnoutContext(userId, scopedTasks, { now, twoWeekStart, capacityHoursPerWeek }) {
  const userTasks = scopedTasks.filter((task) => taskAssignedToUser(task, userId));
  const completedTasks = userTasks.filter((t) => String(t?.status || '').toLowerCase() === 'done');
  const activeTasks = userTasks.filter((t) => String(t?.status || '').toLowerCase() !== 'done');

  const blockedOpenTasks = activeTasks.filter(
    (task) => task?.isBlocked || (Array.isArray(task?.blockedBy) && task.blockedBy.length > 0)
  ).length;

  const weightedActiveLoad = activeTasks.reduce(
    (sum, task) => sum + activeTaskResponsibilityWeight(task, userId),
    0
  );

  const weightedBlockedLoad = activeTasks.reduce((sum, task) => {
    const isBlocked = task?.isBlocked || (Array.isArray(task?.blockedBy) && task.blockedBy.length > 0);
    if (!isBlocked) return sum;
    return sum + activeTaskResponsibilityWeight(task, userId);
  }, 0);

  const blockedRatio = weightedActiveLoad > 0 ? weightedBlockedLoad / weightedActiveLoad : 0;

  const overdueOpenTasks = activeTasks.filter((task) => {
    if (!task?.dueDate) return false;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    return due < now;
  }).length;

  const weightedOverdueLoad = activeTasks.reduce((sum, task) => {
    if (!task?.dueDate) return sum;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime()) || due >= now) return sum;
    return sum + activeTaskResponsibilityWeight(task, userId);
  }, 0);

  const overdueRatio = weightedActiveLoad > 0 ? weightedOverdueLoad / weightedActiveLoad : 0;

  const weeklyLoggedHours = userTasks.reduce((sum, task) => {
    const logs = Array.isArray(task?.worklogs) ? task.worklogs : [];
    const loggedInWindow = logs.reduce((logSum, log) => {
      if (toIdString(log?.user) !== toIdString(userId)) return logSum;
      const logDate = log?.date ? new Date(log.date) : log?.createdAt ? new Date(log.createdAt) : null;
      if (!logDate || Number.isNaN(logDate.getTime()) || logDate < twoWeekStart) return logSum;
      return logSum + safeNumber(Number(log?.hours || 0));
    }, 0);
    return sum + loggedInWindow;
  }, 0) / 2;

  const normalizedCapacity = Math.max(1, safeNumber(Number(capacityHoursPerWeek || 40)));
  const loadRatio = weeklyLoggedHours / normalizedCapacity;

  const burnoutScore = Number(
    clamp(
      Math.min(100, loadRatio * 100) * 0.45 + blockedRatio * 100 * 0.3 + overdueRatio * 100 * 0.25,
      0,
      100
    ).toFixed(2)
  );

  return {
    userTasks,
    completedTasks,
    activeTasks,
    blockedOpenTasks,
    overdueOpenTasks,
    weeklyLoggedHours: Number(weeklyLoggedHours.toFixed(2)),
    blockedRatio,
    overdueRatio,
    burnoutScore,
  };
}

export const calculateBurndown = async (sprintId) => {
  // Ideal line uses current startDate→endDate window (includes PM-extended endDate).
  const sprint = await Sprint.findById(sprintId)
    .select('_id projectId startDate endDate createdAt originalEndDateAtStart wasExtended')
    .lean();
  if (!sprint) throw new Error('Sprint not found');

  const tasks = await Task.find({ project: sprint.projectId, sprint: sprint._id })
    .select('storyPoints status completedAt updatedAt statusHistory')
    .lean();

  const totalPoints = tasks.reduce((sum, task) => sum + safeNumber(task.storyPoints), 0);

  const sprintStart = new Date(sprint.startDate || sprint.createdAt);
  const sprintEnd = new Date(sprint.endDate || new Date(sprintStart.getTime() + 14 * 24 * 60 * 60 * 1000)); // Default 2 weeks

  const daysDuration = Math.max(1, Math.ceil((sprintEnd - sprintStart) / (1000 * 60 * 60 * 24)));
  const burndownData = [];

  for (let i = 0; i <= daysDuration; i++) {
    const currentDate = new Date(sprintStart.getTime() + i * 24 * 60 * 60 * 1000);
    currentDate.setHours(23, 59, 59, 999);

    const completedPoints = tasks.reduce((sum, task) => {
      const doneAt = resolveTaskCompletedAt(task);
      if (!doneAt || doneAt > currentDate) return sum;
      return sum + safeNumber(task.storyPoints);
    }, 0);

    const idealPoints = Math.max(0, totalPoints - (totalPoints / daysDuration) * i);

    burndownData.push({
      date: currentDate.toISOString().split('T')[0],
      ideal: parseFloat(idealPoints.toFixed(1)),
      actual: Math.max(0, Number((totalPoints - completedPoints).toFixed(1))),
    });

    if (currentDate > new Date() && i > 0) {
      burndownData[i].actual = null;
    }
  }

  return {
    sprintId: sprint._id,
    totalStoryPoints: totalPoints,
    data: burndownData,
  };
};

export const calculateVelocity = async (projectId) => {
  const sprints = await Sprint.find({
    projectId,
    status: 'completed',
  })
    .select('_id title committedPoints completedPoints endDate completedAt')
    .sort({ completedAt: -1, endDate: -1 })
    .limit(6);

  const sprintIds = sprints.map((s) => s._id);
  const sprintTasks =
    sprintIds.length > 0
      ? await Task.find({ project: projectId, sprint: { $in: sprintIds } })
          .select('sprint storyPoints status')
          .lean()
      : [];

  const tasksBySprint = new Map();
  sprintTasks.forEach((task) => {
    const sid = toIdString(task?.sprint);
    if (!tasksBySprint.has(sid)) tasksBySprint.set(sid, []);
    tasksBySprint.get(sid).push(task);
  });

  const velocityData = sprints
    .slice()
    .reverse()
    .map((s) => {
      const tasks = tasksBySprint.get(toIdString(s._id)) || [];
      const plannedFromTasks = tasks.reduce((sum, task) => sum + safeNumber(Number(task?.storyPoints || 0)), 0);
      const completedFromTasks = tasks
        .filter((task) => String(task?.status || '').toLowerCase() === 'done')
        .reduce((sum, task) => sum + safeNumber(Number(task?.storyPoints || 0)), 0);

      const committedSnapshot = safeNumber(Number(s?.committedPoints || 0));
      const completedSnapshot = safeNumber(Number(s?.completedPoints || 0));

      const planned = committedSnapshot > 0 ? committedSnapshot : plannedFromTasks;
      const completed = completedFromTasks > 0 ? completedFromTasks : completedSnapshot;

      return {
        sprintName: s.title,
        completed: Number(completed.toFixed(2)),
        planned: Number(planned.toFixed(2)),
      };
    });

  const activeSprint = await Sprint.findOne({ projectId, status: 'active' })
    .select('_id title committedPoints')
    .sort({ startedAt: -1, startDate: -1 })
    .lean();

  let liveSprint = null;
  if (activeSprint) {
    const activeTasks = await Task.find({ project: projectId, sprint: activeSprint._id })
      .select('storyPoints status')
      .lean();

    const plannedFromTasks = activeTasks.reduce(
      (sum, task) => sum + safeNumber(Number(task?.storyPoints || 0)),
      0
    );
    const completedFromTasks = activeTasks
      .filter((task) => String(task?.status || '').toLowerCase() === 'done')
      .reduce((sum, task) => sum + safeNumber(Number(task?.storyPoints || 0)), 0);

    const committedSnapshot = safeNumber(Number(activeSprint?.committedPoints || 0));
    const planned = committedSnapshot > 0 ? committedSnapshot : plannedFromTasks;

    liveSprint = {
      sprintId: activeSprint._id,
      sprintName: activeSprint.title,
      planned: Number(planned.toFixed(2)),
      completed: Number(completedFromTasks.toFixed(2)),
      completionRate: planned > 0 ? Number(((completedFromTasks / planned) * 100).toFixed(1)) : 0,
    };
  }

  const averageVelocity =
    velocityData.length > 0
      ? velocityData.reduce((sum, s) => sum + s.completed, 0) / velocityData.length
      : 0;

  return {
    averageVelocity: Math.round(averageVelocity),
    data: velocityData,
    hasHistory: velocityData.length > 0,
    liveSprint,
  };
};

export const calculateTeamStats = async (projectId, { sprintId = null } = {}) => {
  const project = await Project.findById(projectId).populate(
    'members.user',
    'name avatar role aiBurnoutRiskScore aiBurnoutRiskLevel aiBurnoutLastAnalyzed aiBurnoutHistory capacityHoursPerWeek'
  );
  if (!project) throw new Error('Project not found');

  const tasksQuery = { project: projectId };
  if (sprintId) {
    tasksQuery.sprint = sprintId;
  }

  const tasks = await Task.find(tasksQuery)
    .select('project sprint status assignee assignees subtasks worklogs storyPoints dueDate isBlocked blockedBy statusHistory')
    .lean();

  const projectMemberIds = (project.members || [])
    .map((member) => member?.user?._id)
    .filter(Boolean);

  const allUserTasks =
    projectMemberIds.length > 0
      ? await Task.find({
          $or: [
            { assignee: { $in: projectMemberIds } },
            { 'assignees.user': { $in: projectMemberIds } },
            { 'subtasks.assignee': { $in: projectMemberIds } },
          ],
        })
          .select('project sprint status assignee assignees subtasks worklogs storyPoints dueDate isBlocked blockedBy statusHistory')
          .lean()
      : [];

  const now = new Date();
  const twoWeekWindowMs = 14 * MS_PER_DAY;
  const twoWeekStart = new Date(now.getTime() - twoWeekWindowMs);

  const teamStats = project.members.map((member) => {
    const projectContext = computeBurnoutContext(member.user._id, tasks, {
      now,
      twoWeekStart,
      capacityHoursPerWeek: member?.user?.capacityHoursPerWeek || 40,
    });

    const globalContext = computeBurnoutContext(member.user._id, allUserTasks, {
      now,
      twoWeekStart,
      capacityHoursPerWeek: member?.user?.capacityHoursPerWeek || 40,
    });

    const totalPoints = projectContext.userTasks.reduce(
      (sum, task) => sum + safeNumber(taskPointsForUser(task, member.user._id)),
      0
    );
    const completedPoints = projectContext.completedTasks.reduce(
      (sum, task) =>
        sum + safeNumber(taskPointsForUser(task, member.user._id, { preferWorklogs: true })),
      0
    );

    const capacityHoursPerWeek = Math.max(1, safeNumber(Number(member?.user?.capacityHoursPerWeek || 40)));

    const burnoutHistory = Array.isArray(member?.user?.aiBurnoutHistory)
      ? member.user.aiBurnoutHistory
          .map((entry) => safeNumber(Number(entry?.score)))
          .filter((value) => Number.isFinite(value))
      : [];
    const recentHistory = burnoutHistory.slice(-5);
    const aiBurnoutTrendDelta =
      recentHistory.length >= 2
        ? Number((recentHistory[recentHistory.length - 1] - recentHistory[0]).toFixed(2))
        : 0;

    const projectBurnoutScore = projectContext.burnoutScore;
    const globalBurnoutScore = globalContext.burnoutScore;
    const overallBurnoutScore = Number(
      clamp(globalBurnoutScore * 0.7 + projectBurnoutScore * 0.3, 0, 100).toFixed(2)
    );

    return {
      user: member.user,
      tasksAssigned: projectContext.userTasks.length,
      tasksCompleted: projectContext.completedTasks.length,
      storyPoints: Number(totalPoints.toFixed(2)),
      completedStoryPoints: Number(completedPoints.toFixed(2)),
      blockedOpenTasks: projectContext.blockedOpenTasks,
      overdueOpenTasks: projectContext.overdueOpenTasks,
      weeklyLoggedHours: projectContext.weeklyLoggedHours,
      globalWeeklyLoggedHours: globalContext.weeklyLoggedHours,
      capacityHoursPerWeek,
      projectBurnoutScore,
      globalBurnoutScore,
      overallBurnoutScore,
      aiBurnoutRiskScore: safeNumber(Number(member?.user?.aiBurnoutRiskScore || 0)),
      aiBurnoutTrendDelta,
      burnoutHistorySamples: burnoutHistory.length,
      completionRate:
        projectContext.userTasks.length > 0
          ? (projectContext.completedTasks.length / projectContext.userTasks.length) * 100
          : 0,
    };
  });

  return teamStats;
};

export const calculateOverview = async (projectIds, { performanceLimit = 7, cycleWindowDays = 30 } = {}) => {
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select('_id title color updatedAt')
    .lean();

  const projectMap = new Map(projects.map((p) => [String(p._id), p]));

  const blockers = await Task.countDocuments({
    project: { $in: projectIds },
    status: { $ne: 'done' },
    isBlocked: true,
  });

  const windowStart = new Date(Date.now() - cycleWindowDays * MS_PER_DAY);
  const cycleAgg = await Task.aggregate([
    {
      $match: {
        project: { $in: projectIds },
        startedAt: { $ne: null },
        completedAt: { $ne: null },
        completedAt: { $gte: windowStart },
      },
    },
    { $project: { cycleMs: { $subtract: ['$completedAt', '$startedAt'] } } },
    { $group: { _id: null, avgCycleMs: { $avg: '$cycleMs' }, count: { $sum: 1 } } },
  ]);

  const cycleTimeDays =
    cycleAgg.length > 0 && cycleAgg[0].avgCycleMs
      ? Number((cycleAgg[0].avgCycleMs / MS_PER_DAY).toFixed(1))
      : 0;

  const completedSprints = await Sprint.find({
    projectId: { $in: projectIds },
    status: 'completed',
  })
    .select('title projectId committedPoints completedPoints endDate')
    .sort({ endDate: -1 })
    .limit(performanceLimit * 2)
    .lean();

  const last = completedSprints.slice(0, performanceLimit);
  const prev = completedSprints.slice(performanceLimit, performanceLimit * 2);

  const sumDelivered = (items) => items.reduce((sum, s) => sum + safeNumber(s.completedPoints), 0);
  const sumPlanned = (items) => items.reduce((sum, s) => sum + safeNumber(s.committedPoints), 0);

  const deliveredLast = sumDelivered(last);
  const plannedLast = sumPlanned(last);
  const deliveredPrev = sumDelivered(prev);
  const plannedPrev = sumPlanned(prev);

  const avgDeliveredLast = last.length > 0 ? deliveredLast / last.length : 0;
  const avgDeliveredPrev = prev.length > 0 ? deliveredPrev / prev.length : 0;

  const completionRate = plannedLast > 0 ? (deliveredLast / plannedLast) * 100 : 0;
  const completionRatePrev = plannedPrev > 0 ? (deliveredPrev / plannedPrev) * 100 : 0;

  const pctChange = (cur, prevVal) => {
    if (!Number.isFinite(cur) || !Number.isFinite(prevVal) || prevVal === 0) return null;
    return ((cur - prevVal) / Math.abs(prevVal)) * 100;
  };

  const velocityChangePct = pctChange(avgDeliveredLast, avgDeliveredPrev);
  const completionChangePct = pctChange(completionRate, completionRatePrev);

  const orgPerformance = last
    .slice()
    .reverse()
    .map((s) => {
      const p = projectMap.get(String(s.projectId));
      const projectTitle = p?.title || 'Project';
      return {
        label: `${projectTitle}`,
        sprint: s.title,
        planned: safeNumber(s.committedPoints),
        delivered: safeNumber(s.completedPoints),
      };
    });

  const sortedProjects = projects
    .slice()
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, 4);

  const projectHealth = [];
  for (const p of sortedProjects) {
    const activeSprint = await Sprint.findOne({ projectId: p._id, status: 'active' })
      .select('_id title')
      .sort({ startDate: -1 })
      .lean();

    if (!activeSprint) {
      projectHealth.push({
        projectId: p._id,
        title: p.title,
        color: p.color,
        status: 'No Active Sprint',
        percent: 0,
      });
      continue;
    }

    const sprintTasks = await Task.find({ project: p._id, sprint: activeSprint._id })
      .select('storyPoints status')
      .lean();

    const totalPts = sprintTasks.reduce((sum, t) => sum + safeNumber(t.storyPoints), 0);
    const donePts = sprintTasks
      .filter((t) => t.status === 'done')
      .reduce((sum, t) => sum + safeNumber(t.storyPoints), 0);

    const totalCount = sprintTasks.length;
    const doneCount = sprintTasks.filter((t) => t.status === 'done').length;

    const percent =
      totalPts > 0
        ? Math.round((donePts / totalPts) * 100)
        : totalCount > 0
          ? Math.round((doneCount / totalCount) * 100)
          : 0;

    const status = percent >= 70 ? 'On Track' : percent >= 40 ? 'At Risk' : 'Critical';
    projectHealth.push({ projectId: p._id, title: p.title, color: p.color, status, percent });
  }

  return {
    stats: {
      totalVelocity: Math.round(avgDeliveredLast),
      completionRate: Number(completionRate.toFixed(1)),
      blockers,
      cycleTimeDays,
      velocityChangePct,
      completionChangePct,
    },
    orgPerformance,
    projectHealth,
  };
};
