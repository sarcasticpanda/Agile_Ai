import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import { apiResponse } from '../utils/apiResponse.js';

/**
 * GET /api/sprints/:id/autopsy
 * Generates a data-driven sprint autopsy report
 */
export const getSprintAutopsy = async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id)
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignee', select: 'name avatar email' },
          { path: 'blockedBy', select: 'title status' },
        ],
      })
      .lean();

    if (!sprint) return apiResponse(res, 404, false, null, 'Sprint not found');

    const tasks = sprint.tasks || [];
    const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const completedTasks = tasks.filter((t) => t.status === 'done');
    const completedPoints = completedTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

    // ─── Completion Stats ─────────────────────────────────────────────────
    const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
    const pointCompletionRate = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

    // ─── By Type Breakdown ─────────────────────────────────────────────────
    const byType = tasks.reduce((acc, task) => {
      const type = task.type || 'story';
      if (!acc[type]) acc[type] = { total: 0, completed: 0, points: 0, completedPoints: 0 };
      acc[type].total += 1;
      acc[type].points += task.storyPoints || 0;
      if (task.status === 'done') {
        acc[type].completed += 1;
        acc[type].completedPoints += task.storyPoints || 0;
      }
      return acc;
    }, {});

    // ─── By Priority Breakdown ─────────────────────────────────────────────
    const byPriority = tasks.reduce((acc, task) => {
      const p = task.priority || 'medium';
      if (!acc[p]) acc[p] = { total: 0, completed: 0 };
      acc[p].total += 1;
      if (task.status === 'done') acc[p].completed += 1;
      return acc;
    }, {});

    // ─── Spillover tasks (not completed) ──────────────────────────────────
    const spilloverTasks = tasks
      .filter((t) => t.status !== 'done')
      .map((t) => ({
        id: t._id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        storyPoints: t.storyPoints,
        status: t.status,
        assignee: t.assignee,
      }));

    // ─── Time Overruns ─────────────────────────────────────────────────────
    const timeOverruns = tasks
      .filter((t) => t.estimatedHours > 0 && t.actualHours > t.estimatedHours)
      .map((t) => ({
        id: t._id,
        title: t.title,
        estimatedHours: t.estimatedHours,
        actualHours: t.actualHours,
        overrunPct: Math.round(((t.actualHours - t.estimatedHours) / t.estimatedHours) * 100),
        assignee: t.assignee,
      }))
      .sort((a, b) => b.overrunPct - a.overrunPct)
      .slice(0, 5);

    // ─── Team Performance ─────────────────────────────────────────────────
    const memberMap = {};
    tasks.forEach((task) => {
      if (!task.assignee) return;
      const uid = task.assignee._id?.toString() || 'unassigned';
      if (!memberMap[uid]) {
        memberMap[uid] = {
          user: task.assignee,
          tasksAssigned: 0,
          tasksCompleted: 0,
          pointsAssigned: 0,
          pointsCompleted: 0,
        };
      }
      memberMap[uid].tasksAssigned += 1;
      memberMap[uid].pointsAssigned += task.storyPoints || 0;
      if (task.status === 'done') {
        memberMap[uid].tasksCompleted += 1;
        memberMap[uid].pointsCompleted += task.storyPoints || 0;
      }
    });
    const teamPerformance = Object.values(memberMap).map((m) => ({
      ...m,
      completionRate: m.tasksAssigned > 0 ? Math.round((m.tasksCompleted / m.tasksAssigned) * 100) : 0,
    }));

    // ─── What Went Well / What Overran ────────────────────────────────────
    const wentWell = [];
    const wentBad = [];

    if (completionRate >= 80) wentWell.push(`High task completion rate: ${Math.round(completionRate)}% of tasks done`);
    if (completionRate < 60) wentBad.push(`Low completion: only ${Math.round(completionRate)}% of tasks finished`);

    if (spilloverTasks.length === 0) wentWell.push('Zero spillover — all committed tasks delivered');
    if (spilloverTasks.length > 3) wentBad.push(`${spilloverTasks.length} tasks spilled over to next sprint`);

    if (timeOverruns.length === 0) wentWell.push('Estimates were accurate — no significant time overruns');
    if (timeOverruns.length > 2) wentBad.push(`${timeOverruns.length} tasks significantly exceeded time estimates`);

    const blockedCount = tasks.filter((t) => t.blockedBy?.length > 0).length;
    if (blockedCount === 0) wentWell.push('No blocking dependencies — clean sprint execution');
    if (blockedCount > 2) wentBad.push(`${blockedCount} tasks were blocked by dependencies`);

    // ─── Recommendations ──────────────────────────────────────────────────
    const recommendations = [];
    if (Object.keys(byType).includes('bug') && byType.bug?.total > tasks.length * 0.3) {
      recommendations.push('Bugs account for >30% of sprint work. Consider a dedicated bug sprint or bug triage before next planning.');
    }
    if (pointCompletionRate < 70) {
      recommendations.push(`Your team delivered ${Math.round(pointCompletionRate)}% of committed points. Reduce next sprint commitment by ~${Math.round(100 - pointCompletionRate)}%.`);
    }
    if (teamPerformance.some((m) => m.completionRate < 50 && m.tasksAssigned > 2)) {
      recommendations.push('Some team members completed <50% of assigned tasks. Schedule 1:1s to surface blockers early.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Great sprint! Maintain this pacing in the next sprint and focus on keeping blockers cleared daily.');
    }

    const autopsy = {
      sprint: {
        id: sprint._id,
        title: sprint.title,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
      },
      heroStats: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        completionRate: Math.round(completionRate),
        totalPoints,
        completedPoints,
        pointCompletionRate: Math.round(pointCompletionRate),
        spilloverCount: spilloverTasks.length,
      },
      byType,
      byPriority,
      spilloverTasks,
      timeOverruns,
      teamPerformance,
      wentWell,
      wentBad,
      recommendations,
      generatedAt: new Date(),
    };

    apiResponse(res, 200, true, autopsy, 'Sprint autopsy generated');
  } catch (err) {
    apiResponse(res, 500, false, null, err.message);
  }
};
