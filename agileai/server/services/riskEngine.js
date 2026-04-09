/**
 * AgileAI Risk Engine
 * Calculates sprint risk score (0-100) from 6 data-driven factors.
 * No external AI API required — learns from your team's own history.
 */
import Sprint from '../models/Sprint.model.js';
import Project from '../models/Project.model.js';

const RISK_WEIGHTS = {
  capacityOverload: 0.30,   // Most impactful
  blockers: 0.25,
  idleTasks: 0.20,
  unassignedTasks: 0.10,
  velocityTrend: 0.10,
  durationRealism: 0.05,
};

/**
 * Calculate risk score for a sprint.
 * @param {string} sprintId
 * @returns {{ riskScore, riskLevel, factors, recommendation, teamVelocity, summary }}
 */
export const calculateSprintRisk = async (sprintId) => {
  const sprint = await Sprint.findById(sprintId).populate('tasks').lean();
  if (!sprint) throw new Error('Sprint not found');

  const tasks = sprint.tasks || [];

  // Get historical velocity for this project (last 5 completed sprints)
  const completedSprints = await Sprint.find({
    projectId: sprint.projectId,
    status: 'completed',
    _id: { $ne: sprintId },
  })
    .sort({ completedAt: -1, endDate: -1 })
    .limit(5)
    .lean();

  const avgVelocity =
    completedSprints.length > 0
      ? completedSprints.reduce((sum, sp) => sum + (sp.completedPoints || sp.velocity || 0), 0) /
        completedSprints.length
      : 40; // Default assumption if no history

  const tasksPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalPoints = sprint.committedPoints && sprint.committedPoints > 0 ? sprint.committedPoints : tasksPoints;

  const factors = [];
  let totalRisk = 0;

  // ─── Factor 1: Capacity Overload ─────────────────────────────────────────
  const capacityRatio = avgVelocity > 0 ? totalPoints / avgVelocity : 1;
  let capacityRisk = 0;
  let capacityMsg = '';
  if (capacityRatio <= 0.8) {
    capacityRisk = 5;
    capacityMsg = `Team is underloaded (${Math.round(capacityRatio * 100)}% of velocity). Sprint may finish early.`;
  } else if (capacityRatio <= 1.0) {
    capacityRisk = 15;
    capacityMsg = `Sprint capacity is well-matched to velocity (${totalPoints} pts vs avg ${Math.round(avgVelocity)} pts).`;
  } else if (capacityRatio <= 1.2) {
    capacityRisk = 45;
    capacityMsg = `Sprint is ${Math.round((capacityRatio - 1) * 100)}% over average velocity — moderate spillover risk.`;
  } else if (capacityRatio <= 1.5) {
    capacityRisk = 72;
    capacityMsg = `Sprint is ${Math.round((capacityRatio - 1) * 100)}% over capacity. High chance of spillover.`;
  } else {
    capacityRisk = 95;
    capacityMsg = `Critical overload: ${totalPoints} pts committed, team averages ${Math.round(avgVelocity)} pts. Remove ${Math.round(totalPoints - avgVelocity)} pts.`;
  }
  factors.push({
    id: 'capacity',
    name: 'Capacity vs Velocity',
    icon: '⚡',
    impact: Math.round(capacityRisk * RISK_WEIGHTS.capacityOverload),
    rawScore: capacityRisk,
    direction: capacityRisk > 30 ? 'negative' : 'positive',
    message: capacityMsg,
    detail: `${totalPoints} pts committed / ${Math.round(avgVelocity)} pts avg velocity`,
  });
  totalRisk += capacityRisk * RISK_WEIGHTS.capacityOverload;

  // ─── Factor 2: Blockers ───────────────────────────────────────────────────
  const blockedTasks = tasks.filter((t) => t.blockedBy && t.blockedBy.length > 0);
  const blockedPoints = blockedTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const blockerRatio = totalPoints > 0 ? blockedPoints / totalPoints : 0;
  const blockerRisk = Math.min(95, Math.round(blockerRatio * 220));
  const blockerMsg =
    blockedTasks.length === 0
      ? 'No blocked tasks detected. Clear dependencies.'
      : `${blockedTasks.length} task(s) blocked (${blockedPoints} pts). Resolve before sprint start.`;
  factors.push({
    id: 'blockers',
    name: 'Blocked Tasks',
    icon: '🔴',
    impact: Math.round(blockerRisk * RISK_WEIGHTS.blockers),
    rawScore: blockerRisk,
    direction: blockerRisk > 20 ? 'negative' : 'positive',
    message: blockerMsg,
    detail: `${blockedTasks.length} blocked task(s), ${blockedPoints} story points at risk`,
  });
  totalRisk += blockerRisk * RISK_WEIGHTS.blockers;

  // ─── Factor 3: Idle Tasks (active sprint only) ────────────────────────────
  let idleRisk = 0;
  let idleMsg = '';
  const now = new Date();
  if (sprint.status === 'active') {
    const idleThresholdMs = 3 * 24 * 60 * 60 * 1000; // 3 days
    const idleTasks = tasks.filter((t) => {
      if (t.status === 'done') return false;
      const lastUpdate = new Date(t.updatedAt);
      return now - lastUpdate > idleThresholdMs;
    });
    idleRisk = Math.min(90, idleTasks.length * 18);
    idleMsg =
      idleTasks.length === 0
        ? 'All tasks have recent activity. Good momentum.'
        : `${idleTasks.length} task(s) idle for 3+ days: ${idleTasks.map((t) => `"${t.title.substring(0, 25)}"${t.title.length > 25 ? '...' : ''}`).join(', ')}`;
  } else {
    idleMsg = 'Sprint not yet active — idle tracking starts on sprint start.';
  }
  factors.push({
    id: 'idle',
    name: 'Idle Tasks',
    icon: '💤',
    impact: Math.round(idleRisk * RISK_WEIGHTS.idleTasks),
    rawScore: idleRisk,
    direction: idleRisk > 20 ? 'negative' : 'positive',
    message: idleMsg,
    detail: sprint.status === 'active' ? 'Tasks with no updates in 3+ days' : 'Tracking begins when sprint starts',
  });
  totalRisk += idleRisk * RISK_WEIGHTS.idleTasks;

  // ─── Factor 4: Unassigned Tasks ───────────────────────────────────────────
  const unassigned = tasks.filter((t) => !t.assignee);
  const unassignedRatio = tasks.length > 0 ? unassigned.length / tasks.length : 0;
  const assignRisk = Math.min(80, Math.round(unassignedRatio * 120));
  const assignMsg =
    unassigned.length === 0
      ? 'All tasks have owners. Accountability is clear.'
      : `${unassigned.length} task(s) unassigned (${Math.round(unassignedRatio * 100)}% of sprint). Assign before sprint starts.`;
  factors.push({
    id: 'unassigned',
    name: 'Unassigned Tasks',
    icon: '👤',
    impact: Math.round(assignRisk * RISK_WEIGHTS.unassignedTasks),
    rawScore: assignRisk,
    direction: assignRisk > 20 ? 'negative' : 'positive',
    message: assignMsg,
    detail: `${unassigned.length}/${tasks.length} tasks have no owner`,
  });
  totalRisk += assignRisk * RISK_WEIGHTS.unassignedTasks;

  // ─── Factor 5: Velocity Trend ─────────────────────────────────────────────
  let velocityTrendRisk = 20;
  let velocityMsg = 'Not enough historical data to detect velocity trends.';
  if (completedSprints.length >= 3) {
    const recent = completedSprints.slice(0, 2).map((s) => s.completedPoints || s.velocity || 0);
    const older = completedSprints.slice(2).map((s) => s.completedPoints || s.velocity || 0);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const trendPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    if (trendPct >= 10) {
      velocityTrendRisk = 5;
      velocityMsg = `Team velocity improving (+${Math.round(trendPct)}% over last 3 sprints). 🚀`;
    } else if (trendPct >= -10) {
      velocityTrendRisk = 20;
      velocityMsg = `Team velocity is stable (${Math.round(Math.abs(trendPct))}% change over 3 sprints).`;
    } else if (trendPct >= -25) {
      velocityTrendRisk = 55;
      velocityMsg = `⚠️ Team velocity declining (${Math.round(trendPct)}% over 3 sprints). Investigate blockers.`;
    } else {
      velocityTrendRisk = 85;
      velocityMsg = `🔴 Team velocity dropped ${Math.round(Math.abs(trendPct))}%. At this rate, sprint goals are unlikely to be met.`;
    }
  }
  factors.push({
    id: 'velocity_trend',
    name: 'Velocity Trend',
    icon: '📉',
    impact: Math.round(velocityTrendRisk * RISK_WEIGHTS.velocityTrend),
    rawScore: velocityTrendRisk,
    direction: velocityTrendRisk > 30 ? 'negative' : 'positive',
    message: velocityMsg,
    detail: `Based on ${completedSprints.length} completed sprint(s)`,
  });
  totalRisk += velocityTrendRisk * RISK_WEIGHTS.velocityTrend;

  // ─── Factor 6: Duration Realism ───────────────────────────────────────────
  let durationRisk = 15;
  let durationMsg = 'Sprint dates look reasonable.';
  if (sprint.startDate && sprint.endDate) {
    const durationDays = Math.ceil(
      (new Date(sprint.endDate) - new Date(sprint.startDate)) / (1000 * 60 * 60 * 24)
    );
    const workingDays = Math.round(durationDays * (5 / 7)); // Approximate weekdays
    const ptsPerDay = workingDays > 0 ? totalPoints / workingDays : totalPoints;
    const teamSize = (await Project.findById(sprint.projectId).lean())?.members?.length || 3;
    const ptsPerPersonPerDay = ptsPerDay / teamSize;

    if (ptsPerPersonPerDay <= 2) {
      durationRisk = 5;
      durationMsg = `Sprint duration is comfortable (${workingDays} working days, ~${ptsPerPersonPerDay.toFixed(1)} pts/person/day).`;
    } else if (ptsPerPersonPerDay <= 4) {
      durationRisk = 25;
      durationMsg = `Moderate pace: ${ptsPerPersonPerDay.toFixed(1)} pts/person/day over ${workingDays} days.`;
    } else {
      durationRisk = 70;
      durationMsg = `Aggressive timeline: ${ptsPerPersonPerDay.toFixed(1)} pts/person/day — consider extending sprint or reducing scope.`;
    }
  }
  factors.push({
    id: 'duration',
    name: 'Sprint Duration',
    icon: '📅',
    impact: Math.round(durationRisk * RISK_WEIGHTS.durationRealism),
    rawScore: durationRisk,
    direction: durationRisk > 40 ? 'negative' : 'positive',
    message: durationMsg,
    detail: sprint.startDate && sprint.endDate ? 'Based on sprint dates and team size' : 'No dates set for this sprint',
  });
  totalRisk += durationRisk * RISK_WEIGHTS.durationRealism;

  // ─── Final Score ──────────────────────────────────────────────────────────
  const riskScore = Math.min(100, Math.round(totalRisk));
  const riskLevel = riskScore >= 65 ? 'high' : riskScore >= 35 ? 'medium' : 'low';

  // Generate human-readable recommendation
  const topFactor = [...factors].sort((a, b) => b.rawScore - a.rawScore)[0];
  const recommendation = generateRecommendation(riskScore, topFactor, totalPoints, avgVelocity);

  return {
    sprintId,
    riskScore,
    riskLevel,
    teamVelocity: Math.round(avgVelocity),
    totalPoints,
    confidence: completedSprints.length >= 3 ? 'high' : completedSprints.length >= 1 ? 'medium' : 'low',
    factors: factors.sort((a, b) => b.rawScore - a.rawScore),
    recommendation,
    summary: `Sprint "${sprint.title}" has a ${riskScore}% risk score (${riskLevel.toUpperCase()}) based on ${factors.length} factors.`,
    generatedAt: new Date(),
  };
};

function generateRecommendation(riskScore, topFactor, totalPoints, velocity) {
  if (riskScore < 35) {
    return '✅ Sprint looks healthy. Maintain current pacing and keep blockers cleared daily.';
  }
  if (topFactor.id === 'capacity') {
    const excess = Math.round(totalPoints - velocity);
    return `⚠️ Remove ${excess > 0 ? excess : 'some'} story points from this sprint to align with team velocity. Focus on your highest-priority items.`;
  }
  if (topFactor.id === 'blockers') {
    return '🔴 Resolve blocked tasks before starting the sprint. Hold a dependency review meeting and assign owners to unblock each item.';
  }
  if (topFactor.id === 'idle') {
    return '💤 Schedule a daily standup check on idle tasks. Set a 24h response SLA for blocked/stalled work.';
  }
  if (topFactor.id === 'unassigned') {
    return '👤 Assign every task before the sprint starts. Unowned tasks are invisible risks — they always take longer.';
  }
  return `⚠️ Risk score is ${riskScore}%. Address the top factor "${topFactor.name}" to reduce spillover risk.`;
}
