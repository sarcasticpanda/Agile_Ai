import { apiResponse } from '../utils/apiResponse.js';
import * as aiProxyService from '../services/aiProxy.service.js';
import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import User from '../models/User.model.js';
import Project from '../models/Project.model.js';

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
      const projectIds = Array.from(await getAccessibleProjectIdSet(req));
      if (projectIds.length > 0) {
        const sharedTask = await Task.exists({
          assignee: targetUser._id,
          project: { $in: projectIds },
        });
        authorized = Boolean(sharedTask);
      }
    }

    if (!authorized) {
      return apiResponse(res, 403, false, null, 'Not authorized for this user');
    }
  }

  try {
    const result = await aiProxyService.predictBurnout({ userId });
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
