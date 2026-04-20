import { apiResponse } from '../utils/apiResponse.js';
import * as aiProxyService from '../services/aiProxy.service.js';
import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import mongoose from 'mongoose';

const getAccessibleProjectIdSet = async (req) => {
  if (req.user.role === 'admin') return null;
  if (req._accessibleProjectIdSet) return req._accessibleProjectIdSet;

  const userProjects = await Project.find({
    $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
  })
    .select('_id')
    .lean();

  req._accessibleProjectIdSet = new Set(userProjects.map((p) => String(p._id)));
  return req._accessibleProjectIdSet;
};

const ensureProjectAccess = async (req, res, projectId, message) => {
  if (req.user.role === 'admin') return true;
  const projectIds = await getAccessibleProjectIdSet(req);
  if (!projectIds.has(String(projectId))) {
    apiResponse(res, 403, false, null, message);
    return false;
  }
  return true;
};

const userSharesProjectTask = async (targetUserId, projectIdSet) => {
  const ids = Array.from(projectIdSet || []).filter(Boolean).map(String);
  if (!ids.length) return false;
  return Boolean(
    await Task.exists({
      project: { $in: ids },
      $or: [
        { assignee: targetUserId },
        { 'assignees.user': targetUserId },
        { 'subtasks.assignee': targetUserId },
      ],
    })
  );
};

export const predictRisk = async (req, res) => {
  const { sprintId } = req.body;
  if (!sprintId) {
    return apiResponse(res, 400, false, null, 'sprintId is required');
  }

  const sprint = await Sprint.findById(sprintId).select('_id projectId').lean();
  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureProjectAccess(req, res, sprint.projectId, 'Not authorized for this sprint'))) {
    return;
  }

  try {
    const result = await aiProxyService.predictRisk({ sprintId });

    if (!result || result.ok !== true) {
      return apiResponse(res, 503, false, { aiAvailable: false }, 'AI Service unavailable');
    }

    const aiLastAnalyzed = result?.computedAt ? new Date(result.computedAt) : new Date();
    const aiRiskFactors = Array.isArray(result?.riskFactors)
      ? result.riskFactors.map((f) => ({
          factor: f?.factor,
          impact: f?.impact,
          direction: f?.direction,
        }))
      : [];

    const updated = await Sprint.findByIdAndUpdate(
      sprintId,
      {
        aiRiskScore: result?.riskScore ?? null,
        aiRiskLevel: result?.riskLevel ?? null,
        aiRiskFactors,
        aiLastAnalyzed,
      },
      { new: true }
    );

    if (!updated) {
      return apiResponse(res, 500, false, null, 'Sprint not found in API database');
    }

    return apiResponse(res, 200, true, result, 'AI Risk Prediction');
  } catch (error) {
    return apiResponse(res, 503, false, null, error?.message || 'AI Service unavailable');
  }
};

export const estimateEffort = async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return apiResponse(res, 400, false, null, 'taskId is required');
  }

  const task = await Task.findById(taskId).select('_id project').lean();
  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (!(await ensureProjectAccess(req, res, task.project, 'Not authorized for this task'))) {
    return;
  }

  try {
    const result = await aiProxyService.estimateEffort({ taskId });

    if (!result || result.ok !== true) {
      return apiResponse(res, 503, false, { aiAvailable: false }, 'AI Service unavailable');
    }

    const computedAt = result?.computedAt ? new Date(result.computedAt) : new Date();

    const updated = await Task.findByIdAndUpdate(
      taskId,
      {
        aiEstimatedStoryPoints: result?.predictedStoryPoints ?? null,
        aiEstimatedStoryPointsAt: computedAt,
        aiEffortModelVersion: result?.modelVersion ?? null,
        aiEstimatedHours: result?.aiEstimatedHours ?? null,
        aiHoursPerPointBaseline: result?.hoursPerPointBaseline ?? null,
        aiHoursPerPointSampleCount: result?.hoursPerPointSampleCount ?? null,
        aiHoursDerivedAt: computedAt,
        aiEstimateConfidence: result?.aiEstimateConfidence ?? null,
      },
      { new: true }
    );

    if (!updated) {
      return apiResponse(res, 500, false, null, 'Task not found in API database');
    }

    return apiResponse(res, 200, true, result, 'AI Effort Estimate');
  } catch (error) {
    return apiResponse(res, 503, false, null, error?.message || 'AI Service unavailable');
  }
};

export const getInsights = async (req, res) => {
  const { sprintId } = req.params;

  const sprint = await Sprint.findById(sprintId).select('_id projectId').lean();
  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureProjectAccess(req, res, sprint.projectId, 'Not authorized for this sprint'))) {
    return;
  }

  try {
    const result = await aiProxyService.getInsights({ sprintId });

    if (!result || result.ok !== true) {
      return apiResponse(res, 503, false, { aiAvailable: false }, 'AI Service unavailable');
    }

    // Best-effort persistence (insights includes risk payload in our v1 service)
    if (result?.riskScore !== undefined || result?.riskLevel !== undefined) {
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
    }

    return apiResponse(res, 200, true, result, 'AI Insights');
  } catch (error) {
    return apiResponse(res, 503, false, null, error?.message || 'AI Service unavailable');
  }
};

export const predictBurnout = async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return apiResponse(res, 400, false, null, 'userId is required');
  }

  const targetUser = await User.findById(userId).select('_id managedBy').lean();
  if (!targetUser) {
    return apiResponse(res, 404, false, null, 'User not found');
  }

  if (req.user.role !== 'admin') {
    let authorized = false;

    if (targetUser.managedBy && String(targetUser.managedBy) === String(req.user._id)) {
      authorized = true;
    }

    if (!authorized) {
      const projectIds = await getAccessibleProjectIdSet(req);
      if (projectIds?.size > 0) {
        authorized = await userSharesProjectTask(targetUser._id, projectIds);
      }
    }

    if (!authorized) {
      return apiResponse(res, 403, false, null, 'Not authorized for this user');
    }
  }

  try {
    const result = await aiProxyService.predictBurnout({ userId });

    if (!result || result.ok !== true) {
      return apiResponse(res, 503, false, { aiAvailable: false }, 'AI Service unavailable');
    }

    const computedAt = result?.computedAt ? new Date(result.computedAt) : new Date();

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        aiBurnoutRiskScore: result?.burnoutRiskScore ?? null,
        aiBurnoutRiskLevel: result?.burnoutRiskLevel ?? null,
        aiBurnoutConfidence: result?.burnoutConfidence ?? null,
        aiBurnoutModelVersion: result?.modelVersion ?? null,
        aiBurnoutLastAnalyzed: computedAt,
      },
      { new: true }
    );

    if (!updated) {
      return apiResponse(res, 500, false, null, 'User not found in API database');
    }

    return apiResponse(res, 200, true, result, 'AI Burnout Prediction');
  } catch (error) {
    return apiResponse(res, 503, false, null, error?.message || 'AI Service unavailable');
  }
};

/**
 * GET /api/ai/sprint-risk/:sprintId
 * Returns the most recently computed risk score/level from the Sprint document.
 * Falls back to triggering a new prediction if the sprint has never been analyzed.
 */
export const getSprintRiskCached = async (req, res) => {
  const { sprintId } = req.params;

  if (!mongoose.isValidObjectId(sprintId)) {
    return apiResponse(res, 400, false, null, 'Invalid sprintId');
  }

  const sprint = await Sprint.findById(sprintId)
    .select('_id projectId aiRiskScore aiRiskLevel aiRiskFactors aiLastAnalyzed')
    .lean();

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  if (!(await ensureProjectAccess(req, res, sprint.projectId, 'Not authorized for this sprint'))) {
    return;
  }

  // If we already have a cached score, return it without calling AI service
  if (sprint.aiRiskScore !== null && sprint.aiRiskScore !== undefined) {
    return apiResponse(res, 200, true, {
      sprintId,
      riskScore: sprint.aiRiskScore,
      riskLevel: sprint.aiRiskLevel,
      riskFactors: sprint.aiRiskFactors || [],
      computedAt: sprint.aiLastAnalyzed,
      cached: true,
    }, 'Sprint risk (cached)');
  }

  // No cached score — trigger fresh prediction
  try {
    const result = await aiProxyService.predictRisk({ sprintId });

    if (!result || result.ok !== true) {
      return apiResponse(res, 503, false, { aiAvailable: false }, 'AI Service unavailable');
    }

    const aiLastAnalyzed = result?.computedAt ? new Date(result.computedAt) : new Date();
    const aiRiskFactors = Array.isArray(result?.riskFactors)
      ? result.riskFactors.map((f) => ({ factor: f?.factor, impact: f?.impact, direction: f?.direction }))
      : [];

    await Sprint.findByIdAndUpdate(sprintId, {
      aiRiskScore: result?.riskScore ?? null,
      aiRiskLevel: result?.riskLevel ?? null,
      aiRiskFactors,
      aiLastAnalyzed,
    });

    return apiResponse(res, 200, true, { ...result, cached: false }, 'Sprint risk (fresh)');
  } catch (error) {
    return apiResponse(res, 503, false, null, error?.message || 'AI Service unavailable');
  }
};

/**
 * GET /api/ai/burnout/:userId
 * Returns the logged-in user's own burnout score, or PM/admin querying a subordinate's score.
 * Developers can ONLY access their own userId.
 */
export const getMyBurnout = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return apiResponse(res, 400, false, null, 'Invalid userId');
  }

  const requestorId = String(req.user._id);
  const isDev = req.user.role?.toLowerCase() === 'developer';

  // Developers may only read their own score
  if (isDev && requestorId !== String(userId)) {
    return apiResponse(res, 403, false, null, 'Developers can only view their own burnout score');
  }

  const targetUser = await User.findById(userId)
    .select('_id aiBurnoutRiskScore aiBurnoutRiskLevel aiBurnoutConfidence aiBurnoutLastAnalyzed managedBy')
    .lean();

  if (!targetUser) {
    return apiResponse(res, 404, false, null, 'User not found');
  }

  // PM can only read burnout of devs they manage or share a project with
  if (req.user.role?.toLowerCase() === 'pm') {
    let authorized = String(targetUser.managedBy) === requestorId;
    if (!authorized) {
      const projectIds = await getAccessibleProjectIdSet(req);
      if (projectIds?.size > 0) {
        authorized = await userSharesProjectTask(targetUser._id, projectIds);
      }
    }
    if (!authorized) {
      return apiResponse(res, 403, false, null, 'Not authorized for this user');
    }
  }

  // If cached score exists, return it
  if (targetUser.aiBurnoutRiskScore !== null && targetUser.aiBurnoutRiskScore !== undefined) {
    return apiResponse(res, 200, true, {
      userId,
      burnoutRiskScore: targetUser.aiBurnoutRiskScore,
      burnoutRiskLevel: targetUser.aiBurnoutRiskLevel,
      burnoutConfidence: targetUser.aiBurnoutConfidence,
      computedAt: targetUser.aiBurnoutLastAnalyzed,
      cached: true,
    }, 'Burnout score (cached)');
  }

  // No cached score — trigger fresh prediction (only if not dev-self-request to avoid blocking)
  try {
    const result = await aiProxyService.predictBurnout({ userId });

    if (!result || result.ok !== true) {
      return apiResponse(res, 503, false, { aiAvailable: false }, 'AI Service unavailable');
    }

    const computedAt = result?.computedAt ? new Date(result.computedAt) : new Date();

    await User.findByIdAndUpdate(userId, {
      aiBurnoutRiskScore: result?.burnoutRiskScore ?? null,
      aiBurnoutRiskLevel: result?.burnoutRiskLevel ?? null,
      aiBurnoutConfidence: result?.burnoutConfidence ?? null,
      aiBurnoutLastAnalyzed: computedAt,
    });

    return apiResponse(res, 200, true, { ...result, cached: false }, 'Burnout score (fresh)');
  } catch (error) {
    return apiResponse(res, 503, false, null, error?.message || 'AI Service unavailable');
  }
};
