import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import User from '../models/User.model.js';

const DEFAULT_HOURS_PER_POINT = 4;

const toIdString = (value) =>
  value && typeof value.toString === 'function' ? value.toString() : String(value || '');

const uniqueIds = (ids = []) => {
  const set = new Set();
  for (const id of ids) {
    const normalized = toIdString(id);
    if (!normalized || normalized === 'null' || normalized === 'undefined') continue;
    set.add(normalized);
  }
  return Array.from(set);
};

const taskAssigneeIds = (task) => {
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

const taskPointsForUser = (task, userId) => {
  const storyPoints = Number(task?.storyPoints || 0);
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];

  const subtaskPoints = subtasks
    .filter((s) => toIdString(s?.assignee) === userId)
    .reduce((sum, s) => sum + Number(s?.storyPoints || 0), 0);

  if (subtaskPoints > 0) return subtaskPoints;

  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  if (assignees.length > 0) {
    const match = assignees.find((a) => toIdString(a?.user) === userId);
    if (match) {
      const contribution = Number(match?.contributionPercent);
      if (Number.isFinite(contribution) && contribution > 0) {
        return storyPoints * (contribution / 100);
      }
      return storyPoints / assignees.length;
    }
  }

  if (toIdString(task?.assignee) === userId) return storyPoints;
  return 0;
};

const getSprintWeeks = (sprint) => {
  if (!sprint?.startDate || !sprint?.endDate) return 2;
  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 2;

  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.min(4, days / 7));
};

export const getAssignmentWarnings = async ({
  assigneeIds,
  projectId = null,
  sprintId = null,
  incomingStoryPoints = 0,
  incomingContributionByUser = {},
}) => {
  const targetIds = uniqueIds(assigneeIds);
  if (targetIds.length === 0) {
    return {
      assignees: [],
      summary: {
        assigneeCount: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        canAssign: true,
      },
    };
  }

  const users = await User.find({ _id: { $in: targetIds } })
    .select('name email capacityHoursPerWeek aiBurnoutRiskScore aiBurnoutRiskLevel')
    .lean();

  const userById = new Map(users.map((u) => [toIdString(u._id), u]));

  const activeSprints = await Sprint.find({ status: 'active' }).select('_id projectId startDate endDate').lean();
  const activeSprintIds = new Set(activeSprints.map((s) => toIdString(s._id)));

  let targetSprint = null;
  if (sprintId) {
    targetSprint = await Sprint.findById(sprintId).select('_id startDate endDate projectId').lean();
  }

  const sprintWeeks = getSprintWeeks(targetSprint);

  const openTasks = await Task.find({
    status: { $ne: 'done' },
    $or: [
      { assignee: { $in: targetIds } },
      { 'assignees.user': { $in: targetIds } },
      { 'subtasks.assignee': { $in: targetIds } },
    ],
  })
    .select('title project sprint storyPoints assignee assignees subtasks status')
    .lean();

  const rows = [];
  for (const userId of targetIds) {
    const user = userById.get(userId);
    const userTasks = openTasks.filter((task) => taskAssigneeIds(task).includes(userId));

    const activeUserTasks = userTasks.filter((task) => {
      if (!task?.sprint) return false;
      return activeSprintIds.has(toIdString(task.sprint));
    });

    const activeSprintsForUser = new Set(activeUserTasks.map((task) => toIdString(task.sprint)));
    const activeProjectsForUser = new Set(
      activeUserTasks
        .map((task) => toIdString(task.project))
        .filter((id) => id && id !== 'null' && id !== 'undefined')
    );

    const activeInTargetSprint = activeUserTasks.filter(
      (task) => sprintId && toIdString(task.sprint) === toIdString(sprintId)
    );
    const activeInOtherSprints = activeUserTasks.filter(
      (task) => !sprintId || toIdString(task.sprint) !== toIdString(sprintId)
    );

    const currentPointsLoad = userTasks.reduce((sum, task) => sum + taskPointsForUser(task, userId), 0);

    const incomingShare = Number(incomingContributionByUser?.[userId]);
    const incomingPointsLoad =
      Number.isFinite(incomingShare) && incomingShare >= 0
        ? incomingStoryPoints * (incomingShare / 100)
        : incomingStoryPoints / targetIds.length;

    const projectedPointsLoad = currentPointsLoad + incomingPointsLoad;

    const rawCapacityHours = Number(user?.capacityHoursPerWeek);
    const capacityHoursPerWeek =
      Number.isFinite(rawCapacityHours) && rawCapacityHours > 0 ? rawCapacityHours : null;
    const capacityStoryPoints =
      capacityHoursPerWeek != null
        ? (capacityHoursPerWeek * sprintWeeks) / DEFAULT_HOURS_PER_POINT
        : null;

    const rawBurnoutScore = Number(user?.aiBurnoutRiskScore);
    const burnoutScore = Number.isFinite(rawBurnoutScore) ? rawBurnoutScore : null;
    const burnoutLevel = user?.aiBurnoutRiskLevel
      ? String(user.aiBurnoutRiskLevel).toLowerCase()
      : null;

    const warnings = [];

    if (burnoutLevel === 'high' || (burnoutScore != null && burnoutScore >= 70)) {
      warnings.push({
        code: 'burnout_high',
        severity: 'high',
        message: `High burnout risk (${Math.round(burnoutScore ?? 0)}). Consider redistributing work.`,
      });
    } else if (burnoutLevel === 'medium' || (burnoutScore != null && burnoutScore >= 45)) {
      warnings.push({
        code: 'burnout_medium',
        severity: 'medium',
        message: `Medium burnout risk (${Math.round(burnoutScore ?? 0)}). Assign carefully.`,
      });
    } else if (!burnoutLevel && burnoutScore == null) {
      warnings.push({
        code: 'burnout_unavailable',
        severity: 'medium',
        message: 'Burnout signal unavailable. Recommendation confidence reduced.',
      });
    }

    if (activeInOtherSprints.length > 0) {
      warnings.push({
        code: 'cross_sprint_load',
        severity: activeInOtherSprints.length >= 3 ? 'high' : 'medium',
        message: `Already active in ${activeInOtherSprints.length} task(s) across other active sprint(s).`,
      });
    }

    if (capacityStoryPoints != null && capacityStoryPoints > 0) {
      const overloadRatio = projectedPointsLoad / capacityStoryPoints;
      if (overloadRatio >= 1.3) {
        warnings.push({
          code: 'capacity_overload_high',
          severity: 'high',
          message: `Projected load ${projectedPointsLoad.toFixed(1)} pts exceeds estimated capacity ${capacityStoryPoints.toFixed(1)} pts.`,
        });
      } else if (overloadRatio >= 1.1) {
        warnings.push({
          code: 'capacity_overload_medium',
          severity: 'medium',
          message: `Projected load is near capacity (${projectedPointsLoad.toFixed(1)} / ${capacityStoryPoints.toFixed(1)} pts).`,
        });
      }
    } else {
      warnings.push({
        code: 'capacity_unavailable',
        severity: 'medium',
        message: 'Weekly capacity is not configured for this user. Recommendation confidence reduced.',
      });
    }

    if (activeUserTasks.length >= 6) {
      warnings.push({
        code: 'task_count_high',
        severity: 'medium',
        message: `Has ${activeUserTasks.length} open active-sprint tasks.`,
      });
    }

    const hasHigh = warnings.some((w) => w.severity === 'high');
    const hasMedium = warnings.some((w) => w.severity === 'medium');
    const recommendation = hasHigh ? 'avoid' : hasMedium ? 'caution' : 'ok';

    const reasonCodes = warnings.map((warning) => warning.code);
    if (!hasHigh && !hasMedium) {
      reasonCodes.push('no_assignment_warnings');
    }
    const recommendationReason =
      recommendation === 'avoid'
        ? 'High-severity assignment advisories detected.'
        : recommendation === 'caution'
          ? 'One or more medium-severity assignment advisories detected.'
          : 'No assignment advisories detected.';

    rows.push({
      userId,
      user: user
        ? {
            _id: user._id,
            name: user.name,
            email: user.email,
            capacityHoursPerWeek,
            burnoutRiskScore: burnoutScore,
            burnoutRiskLevel: burnoutLevel,
          }
        : {
            _id: userId,
            name: 'Unknown user',
            email: null,
            capacityHoursPerWeek,
            burnoutRiskScore: burnoutScore,
            burnoutRiskLevel: burnoutLevel,
          },
      metrics: {
        activeOpenTasks: activeUserTasks.length,
        activeInTargetSprint: activeInTargetSprint.length,
        activeInOtherSprints: activeInOtherSprints.length,
        activeSprintsCount: activeSprintsForUser.size,
        activeProjectsCount: activeProjectsForUser.size,
        currentStoryPointsLoad: Number(currentPointsLoad.toFixed(2)),
        incomingStoryPointsLoad: Number(incomingPointsLoad.toFixed(2)),
        projectedStoryPointsLoad: Number(projectedPointsLoad.toFixed(2)),
        estimatedCapacityStoryPoints:
          capacityStoryPoints != null ? Number(capacityStoryPoints.toFixed(2)) : null,
      },
      warnings,
      recommendation,
      recommendationReason,
      recommendationReasonCodes: reasonCodes,
    });
  }

  const highSeverityCount = rows.filter((r) => r.warnings.some((w) => w.severity === 'high')).length;
  const mediumSeverityCount = rows.filter((r) =>
    r.warnings.some((w) => w.severity === 'medium')
  ).length;

  return {
    assignees: rows,
    context: {
      projectId,
      sprintId,
      incomingStoryPoints,
      sprintWeeks,
    },
    summary: {
      assigneeCount: rows.length,
      highSeverityCount,
      mediumSeverityCount,
      canAssign: highSeverityCount === 0,
    },
  };
};
