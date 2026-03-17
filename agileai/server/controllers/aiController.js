import { apiResponse } from '../utils/apiResponse.js';
import * as aiProxyService from '../services/aiProxy.service.js';

export const predictRisk = async (req, res) => {
  const { sprintId } = req.body;
  if (!sprintId) {
    return apiResponse(res, 400, false, null, 'sprintId is required');
  }

  const result = await aiProxyService.predictRisk(sprintId);
  apiResponse(res, 200, true, result, 'Mock AI Risk Prediction');
};

export const estimateEffort = async (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return apiResponse(res, 400, false, null, 'taskId is required');
  }

  const result = await aiProxyService.estimateEffort(taskId);
  apiResponse(res, 200, true, result, 'Mock AI Effort Estimate');
};

export const getInsights = async (req, res) => {
  const { sprintId } = req.params;
  
  const result = await aiProxyService.getInsights(sprintId);
  apiResponse(res, 200, true, result, 'Mock AI Insights');
};
