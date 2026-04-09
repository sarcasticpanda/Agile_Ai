import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

import Task from './models/Task.model.js';
import Sprint from './models/Sprint.model.js';
import User from './models/User.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment.');
  process.exit(1);
}

const OUTPUT_DIR =
  process.env.AI_EXPORT_DIR || path.resolve(__dirname, '..', '..', 'ai-service', 'data_exports');
const BURNOUT_WINDOW_DAYS = Number(process.env.BURNOUT_WINDOW_DAYS || 30);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const typeEncode = {
  story: 0,
  bug: 1,
  task: 2,
  epic: 3,
};

const priorityEncode = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const toId = (v) => (v == null ? null : String(v));
const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const assignmentIdsFromTask = (task) => {
  const ids = new Set();

  const primaryAssignee = toId(task?.assignee);
  if (primaryAssignee) ids.add(primaryAssignee);

  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  for (const entry of assignees) {
    const userId = toId(entry?.user || entry);
    if (userId) ids.add(userId);
  }

  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  for (const subtask of subtasks) {
    const userId = toId(subtask?.assignee);
    if (userId) ids.add(userId);
  }

  ids.delete('');
  ids.delete('null');
  ids.delete('undefined');
  return Array.from(ids);
};

const descBucket = (description) => {
  const len = String(description || '').length;
  if (len === 0) return 0;
  if (len <= 100) return 1;
  if (len <= 500) return 2;
  return 3;
};

const titleLengthNorm = (title) => {
  const raw = String(title || '').length / 100;
  return Math.max(0, Math.min(1, raw));
};

const csvEscape = (value) => {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const writeCsv = async (filePath, columns, rows) => {
  const header = columns.join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(','));
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, [header, ...lines].join('\n'), 'utf8');
};

const parseLocalTimeToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
};

const hoursBetweenDates = (fromDate, toDate) => {
  if (!fromDate || !toDate) return null;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const ms = to.getTime() - from.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
};

const buildRiskRows = (completedSprints, tasksBySprint) => {
  const rows = [];

  for (const sprint of completedSprints) {
    const sprintId = toId(sprint._id);
    const tasks = tasksBySprint.get(sprintId) || [];
    const total = tasks.length;
    if (total === 0) continue;

    let blockedCount = 0;
    let bugCount = 0;
    let highPriorityCount = 0;
    let totalBlockedByLinks = 0;
    let totalChurn = 0;
    let scopeCreepCount = 0;
    const blockers = new Set();

    const startedAt = sprint.startedAt || sprint.startDate || null;

    for (const task of tasks) {
      const blockedBy = Array.isArray(task.blockedBy) ? task.blockedBy : [];
      totalBlockedByLinks += blockedBy.length;
      if (blockedBy.length > 0 || task.isBlocked) blockedCount += 1;

      for (const dep of blockedBy) blockers.add(toId(dep));

      if (String(task.type || '').toLowerCase() === 'bug') bugCount += 1;

      const pr = String(task.priority || '').toLowerCase();
      if (pr === 'high' || pr === 'critical') highPriorityCount += 1;

      const cc = task.changeCounters || {};
      totalChurn += toNumber(cc.priorityChanges, 0);
      totalChurn += toNumber(cc.descriptionChanges, 0);

      if (startedAt && task.addedToSprintAt) {
        const a = new Date(task.addedToSprintAt);
        const s = new Date(startedAt);
        if (!Number.isNaN(a.getTime()) && !Number.isNaN(s.getTime()) && a > s) {
          scopeCreepCount += 1;
        }
      }
    }

    const committedPoints =
      toNumber(sprint.committedPoints, 0) > 0
        ? toNumber(sprint.committedPoints, 0)
        : tasks.reduce((sum, t) => sum + Math.max(0, toNumber(t.storyPoints, 0)), 0);

    const completedPoints =
      toNumber(sprint.completedPoints, 0) > 0
        ? toNumber(sprint.completedPoints, 0)
        : tasks
            .filter((t) => String(t.status || '').toLowerCase() === 'done')
            .reduce((sum, t) => sum + Math.max(0, toNumber(t.storyPoints, 0)), 0);

    const success = committedPoints > 0 && completedPoints >= committedPoints * 0.8 ? 1 : 0;

    rows.push({
      sprint_id: sprintId,
      project_id: toId(sprint.projectId),
      completed_at: sprint.completedAt || '',
      blocked_ratio: blockedCount / total,
      blocking_ratio: blockers.size / total,
      scope_creep_rate: scopeCreepCount / total,
      high_priority_ratio: highPriorityCount / total,
      avg_dependency_links: (totalBlockedByLinks / total) / 10,
      bug_ratio: bugCount / total,
      churn_ratio: totalChurn / (total * 5),
      sprint_size_normalized: Math.min(total, 30) / 30,
      committed_points: committedPoints,
      completed_points: completedPoints,
      success,
    });
  }

  return rows;
};

const buildEffortRows = (tasks) => {
  return tasks.map((task) => {
    const type = String(task.type || '').toLowerCase();
    const priority = String(task.priority || '').toLowerCase();

    return {
      task_id: toId(task._id),
      project_id: toId(task.project),
      created_at: task.createdAt || '',
      completed_at: task.completedAt || '',
      type_encoded: Object.prototype.hasOwnProperty.call(typeEncode, type) ? typeEncode[type] : 2,
      priority_encoded: Object.prototype.hasOwnProperty.call(priorityEncode, priority)
        ? priorityEncode[priority]
        : 1,
      desc_bucket: descBucket(task.description),
      title_length_norm: titleLengthNorm(task.title),
      story_points: Math.max(0, toNumber(task.storyPoints, 0)),
      actual_hours: Math.max(0, toNumber(task.actualHours, 0)),
    };
  });
};

const buildBurnoutRows = (users, tasksByAssignee) => {
  const rows = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - BURNOUT_WINDOW_DAYS * MS_PER_DAY);

  for (const user of users) {
    const userId = toId(user._id);
    const tasks = tasksByAssignee.get(userId) || [];

    const recentTasks = tasks.filter((t) => {
      const updatedAt = t.updatedAt ? new Date(t.updatedAt) : null;
      if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
      return updatedAt >= windowStart;
    });

    const worklogs = [];
    for (const task of tasks) {
      const list = Array.isArray(task.worklogs) ? task.worklogs : [];
      for (const wl of list) {
        const worklogUserId = toId(wl?.user?._id || wl?.user);
        if (worklogUserId && worklogUserId !== userId) continue;

        const d = wl?.date || wl?.createdAt;
        if (!d) continue;
        const date = new Date(d);
        if (Number.isNaN(date.getTime()) || date < windowStart) continue;
        worklogs.push({
          date,
          hours: Math.max(0, toNumber(wl.hours, 0)),
        });
      }
    }

    const totalLoggedHours = worklogs.reduce((sum, wl) => sum + wl.hours, 0);
    const avgWeeklyHours = totalLoggedHours / (BURNOUT_WINDOW_DAYS / 7);
    const capacity = Math.max(1, toNumber(user.capacityHoursPerWeek, 40));

    const workDayStart = parseLocalTimeToMinutes(user.workDayStartLocal);
    const workDayEnd = parseLocalTimeToMinutes(user.workDayEndLocal);

    let afterHoursRatio = null;
    if (worklogs.length > 0 && workDayStart != null && workDayEnd != null) {
      let afterHoursCount = 0;
      for (const wl of worklogs) {
        const minutes = wl.date.getUTCHours() * 60 + wl.date.getUTCMinutes();
        const isAfterHours = minutes < workDayStart || minutes > workDayEnd;
        if (isAfterHours) afterHoursCount += 1;
      }
      afterHoursRatio = afterHoursCount / worklogs.length;
    }

    const blockedTaskRatio =
      recentTasks.length > 0
        ? recentTasks.filter((t) => t.isBlocked || (Array.isArray(t.blockedBy) && t.blockedBy.length > 0)).length /
          recentTasks.length
        : 0;

    const openRecentTasks = recentTasks.filter((t) => String(t?.status || '').toLowerCase() !== 'done');
    const overdueOpenTaskRatio =
      openRecentTasks.length > 0
        ? openRecentTasks.filter((t) => {
            if (!t?.dueDate) return false;
            const due = new Date(t.dueDate);
            if (Number.isNaN(due.getTime())) return false;
            return due < now;
          }).length / openRecentTasks.length
        : 0;

    const reopenEvents = tasks.filter((t) => {
      if (!t.reopenedAt) return false;
      const d = new Date(t.reopenedAt);
      return !Number.isNaN(d.getTime()) && d >= windowStart;
    }).length;

    const projectCount = new Set(recentTasks.map((t) => toId(t.project)).filter(Boolean)).size;

    let statusTransitionCount = 0;
    for (const t of recentTasks) {
      const history = Array.isArray(t.statusHistory) ? t.statusHistory : [];
      statusTransitionCount += history.filter((h) => {
        const changedById = toId(h?.changedBy?._id || h?.changedBy);
        if (changedById && changedById !== userId) return false;

        if (!h.changedAt) return false;
        const d = new Date(h.changedAt);
        return !Number.isNaN(d.getTime()) && d >= windowStart;
      }).length;
    }

    const avgTaskCycleHours = (() => {
      const cycles = recentTasks
        .map((t) => hoursBetweenDates(t.startedAt, t.completedAt))
        .filter((v) => v != null);
      if (cycles.length === 0) return null;
      return cycles.reduce((sum, v) => sum + v, 0) / cycles.length;
    })();

    const mostRecentActivity = recentTasks
      .map((t) => t.lastActivityAt || t.updatedAt)
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const daysSinceLastActivity = mostRecentActivity
      ? (now.getTime() - mostRecentActivity.getTime()) / MS_PER_DAY
      : null;

    rows.push({
      user_id: userId,
      email: user.email || '',
      role: user.role || '',
      timezone: user.timezone || '',
      window_days: BURNOUT_WINDOW_DAYS,
      worklogs_count_window: worklogs.length,
      avg_weekly_logged_hours: avgWeeklyHours,
      capacity_hours_per_week: capacity,
      over_capacity_ratio: avgWeeklyHours / capacity,
      after_hours_worklog_ratio: afterHoursRatio,
      blocked_task_ratio: blockedTaskRatio,
      overdue_open_task_ratio: overdueOpenTaskRatio,
      reopen_events_window: reopenEvents,
      active_projects_window: projectCount,
      status_transitions_window: statusTransitionCount,
      avg_task_cycle_hours_window: avgTaskCycleHours,
      days_since_last_activity: daysSinceLastActivity,
      burnout_label: '',
    });
  }

  return rows;
};

async function main() {
  console.log('Starting training-data export from MongoDB...');
  console.log(`Output directory: ${OUTPUT_DIR}`);

  await mongoose.connect(MONGODB_URI);

  const completedSprints = await Sprint.find({ status: 'completed' })
    .select('_id projectId startDate startedAt completedAt committedPoints completedPoints')
    .lean();

  const sprintIds = completedSprints.map((s) => s._id);
  const sprintTasks =
    sprintIds.length > 0
      ? await Task.find({ sprint: { $in: sprintIds } })
          .select('sprint type priority blockedBy isBlocked changeCounters storyPoints status addedToSprintAt')
          .lean()
      : [];

  const tasksBySprint = new Map();
  for (const task of sprintTasks) {
    const sprintId = toId(task.sprint);
    const arr = tasksBySprint.get(sprintId) || [];
    arr.push(task);
    tasksBySprint.set(sprintId, arr);
  }

  const riskRows = buildRiskRows(completedSprints, tasksBySprint);

  const effortTasks = await Task.find({ storyPoints: { $gt: 0 } })
    .select('_id project type priority title description storyPoints actualHours createdAt completedAt')
    .lean();
  const effortRows = buildEffortRows(effortTasks);

  const activeDevelopers = await User.find({ role: 'developer', status: 'active' })
    .select('_id email role timezone workDayStartLocal workDayEndLocal capacityHoursPerWeek')
    .lean();

  const burnoutTasks = await Task.find({
    $or: [
      { assignee: { $ne: null } },
      { assignees: { $elemMatch: { user: { $ne: null } } } },
      { subtasks: { $elemMatch: { assignee: { $ne: null } } } },
    ],
  })
    .select(
      'assignee assignees.user subtasks.assignee project isBlocked blockedBy reopenedAt statusHistory startedAt completedAt lastActivityAt updatedAt worklogs'
      + ' dueDate status'
    )
    .lean();

  const tasksByAssignee = new Map();
  for (const task of burnoutTasks) {
    const assigneeIds = assignmentIdsFromTask(task);
    if (assigneeIds.length === 0) continue;

    for (const assigneeId of assigneeIds) {
      const arr = tasksByAssignee.get(assigneeId) || [];
      arr.push(task);
      tasksByAssignee.set(assigneeId, arr);
    }
  }

  const burnoutRows = buildBurnoutRows(activeDevelopers, tasksByAssignee);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const riskPath = path.join(OUTPUT_DIR, `risk_training_from_mongo_${timestamp}.csv`);
  const effortPath = path.join(OUTPUT_DIR, `effort_training_from_mongo_${timestamp}.csv`);
  const burnoutPath = path.join(OUTPUT_DIR, `burnout_features_unlabeled_${timestamp}.csv`);
  const summaryPath = path.join(OUTPUT_DIR, `export_summary_${timestamp}.json`);

  await writeCsv(
    riskPath,
    [
      'sprint_id',
      'project_id',
      'completed_at',
      'blocked_ratio',
      'blocking_ratio',
      'scope_creep_rate',
      'high_priority_ratio',
      'avg_dependency_links',
      'bug_ratio',
      'churn_ratio',
      'sprint_size_normalized',
      'committed_points',
      'completed_points',
      'success',
    ],
    riskRows
  );

  await writeCsv(
    effortPath,
    [
      'task_id',
      'project_id',
      'created_at',
      'completed_at',
      'type_encoded',
      'priority_encoded',
      'desc_bucket',
      'title_length_norm',
      'story_points',
      'actual_hours',
    ],
    effortRows
  );

  await writeCsv(
    burnoutPath,
    [
      'user_id',
      'email',
      'role',
      'timezone',
      'window_days',
      'worklogs_count_window',
      'avg_weekly_logged_hours',
      'capacity_hours_per_week',
      'over_capacity_ratio',
      'after_hours_worklog_ratio',
      'blocked_task_ratio',
      'overdue_open_task_ratio',
      'reopen_events_window',
      'active_projects_window',
      'status_transitions_window',
      'avg_task_cycle_hours_window',
      'days_since_last_activity',
      'burnout_label',
    ],
    burnoutRows
  );

  const summary = {
    exportedAt: new Date().toISOString(),
    mongodbUriHostHint: String(MONGODB_URI).slice(0, 40),
    files: {
      risk: riskPath,
      effort: effortPath,
      burnout: burnoutPath,
    },
    counts: {
      completedSprints: completedSprints.length,
      riskRows: riskRows.length,
      effortRows: effortRows.length,
      burnoutRows: burnoutRows.length,
      activeDevelopers: activeDevelopers.length,
    },
    notes: [
      'burnout_label is intentionally blank and must be labeled before training burnout model',
      'risk success label is derived from completed_points >= 80% of committed_points',
      'burnout features include single assignee, multi-assignee, and subtask-assignee workloads',
    ],
  };

  await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('Export complete.');
  console.log(`Risk rows: ${riskRows.length}`);
  console.log(`Effort rows: ${effortRows.length}`);
  console.log(`Burnout rows: ${burnoutRows.length}`);
  console.log(`Summary: ${summaryPath}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  console.error('Training-data export failed.');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
