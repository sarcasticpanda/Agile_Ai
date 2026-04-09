import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import User from '../models/User.model.js';
import * as aiProxyService from './aiProxy.service.js';

const inflightSprints = new Set();
const inflightTasks = new Set();
const inflightUsers = new Set();

const toIdString = (id) => (id && typeof id.toString === 'function' ? id.toString() : String(id));

const persistUserBurnoutPrediction = async (userId, result, { pushHistory = true } = {}) => {
  const computedAt = result?.computedAt ? new Date(result.computedAt) : new Date();

  const update = {
    $set: {
      aiBurnoutRiskScore: result?.burnoutRiskScore ?? null,
      aiBurnoutRiskLevel: result?.burnoutRiskLevel ?? null,
      aiBurnoutConfidence: result?.burnoutConfidence ?? null,
      aiBurnoutModelVersion: result?.modelVersion ?? null,
      aiBurnoutLastAnalyzed: computedAt,
    },
  };

  if (pushHistory) {
    update.$push = {
      aiBurnoutHistory: {
        $each: [
          {
            score: result?.burnoutRiskScore ?? null,
            level: result?.burnoutRiskLevel ?? null,
            confidence: result?.burnoutConfidence ?? null,
            computedAt,
          },
        ],
        $slice: -120,
      },
    };
  }

  await User.findByIdAndUpdate(userId, update);
};

export const refreshUserAiBurnoutNow = async (userId, { pushHistory = true } = {}) => {
  if (!userId) return null;

  const key = toIdString(userId);
  const result = await aiProxyService.predictBurnout({ userId: key });
  if (!result?.ok) return null;

  await persistUserBurnoutPrediction(userId, result, { pushHistory });
  return result;
};

export const queueSprintAiRiskRefresh = (sprintId) => {
  if (!sprintId) return;
  const key = toIdString(sprintId);
  if (inflightSprints.has(key)) return;

  inflightSprints.add(key);

  setImmediate(async () => {
    try {
      const result = await aiProxyService.predictRisk({ sprintId: key });
      if (!result?.ok) return;

      const aiLastAnalyzed = result?.computedAt ? new Date(result.computedAt) : new Date();
      const aiRiskFactors = Array.isArray(result?.riskFactors)
        ? result.riskFactors.map((f) => ({
            factor: f?.factor,
            impact: f?.impact,
            direction: f?.direction,
          }))
        : [];

      await Sprint.findByIdAndUpdate(sprintId, {
        aiRiskScore: result?.riskScore ?? null,
        aiRiskLevel: result?.riskLevel ?? null,
        aiRiskFactors,
        aiLastAnalyzed,
      });
    } catch (error) {
      // Best-effort only; never fail the request if AI is down.
      console.warn('AI sprint risk refresh skipped:', error?.message || error);
    } finally {
      inflightSprints.delete(key);
    }
  });
};

export const queueProjectActiveSprintRiskRefresh = async (projectId) => {
  if (!projectId) return;

  const sprints = await Sprint.find({
    projectId,
    status: { $in: ['planning', 'active'] },
  })
    .select('_id')
    .lean();

  for (const sprint of sprints) {
    queueSprintAiRiskRefresh(sprint._id);
  }
};

export const queueTaskAiEffortRefresh = (taskId) => {
  if (!taskId) return;
  const key = toIdString(taskId);
  if (inflightTasks.has(key)) return;

  inflightTasks.add(key);

  setImmediate(async () => {
    try {
      const result = await aiProxyService.estimateEffort({ taskId: key });
      if (!result?.ok) return;

      const computedAt = result?.computedAt ? new Date(result.computedAt) : new Date();

      await Task.findByIdAndUpdate(taskId, {
        aiEstimatedStoryPoints: result?.predictedStoryPoints ?? null,
        aiEstimatedStoryPointsAt: computedAt,
        aiEffortModelVersion: result?.modelVersion ?? null,
        aiEstimatedHours: result?.aiEstimatedHours ?? null,
        aiHoursPerPointBaseline: result?.hoursPerPointBaseline ?? null,
        aiHoursPerPointSampleCount: result?.hoursPerPointSampleCount ?? null,
        aiHoursDerivedAt: computedAt,
        aiEstimateConfidence: result?.aiEstimateConfidence ?? null,
      });
    } catch (error) {
      console.warn('AI task effort refresh skipped:', error?.message || error);
    } finally {
      inflightTasks.delete(key);
    }
  });
};

export const queueUserAiBurnoutRefresh = (userId) => {
  if (!userId) return;
  const key = toIdString(userId);
  if (inflightUsers.has(key)) return;

  inflightUsers.add(key);

  setImmediate(async () => {
    try {
      await refreshUserAiBurnoutNow(userId, { pushHistory: true });
    } catch (error) {
      console.warn('AI user burnout refresh skipped:', error?.message || error);
    } finally {
      inflightUsers.delete(key);
    }
  });
};
