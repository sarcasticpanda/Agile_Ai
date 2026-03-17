import { apiResponse } from '../utils/apiResponse.js';
import * as analyticsService from '../services/analyticsService.js';
import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';

export const getBurndown = async (req, res) => {
  const { sprintId } = req.params;
  const result = await analyticsService.calculateBurndown(sprintId);
  apiResponse(res, 200, true, result, 'Burndown fetched successfully');
};

export const getVelocity = async (req, res) => {
  const { projectId } = req.params;
  const result = await analyticsService.calculateVelocity(projectId);
  apiResponse(res, 200, true, result, 'Velocity fetched successfully');
};

export const getTeamStats = async (req, res) => {
  const { projectId } = req.params;
  const result = await analyticsService.calculateTeamStats(projectId);
  apiResponse(res, 200, true, result, 'Team stats fetched successfully');
};

export const getCompletionStats = async (req, res) => {
  const { sprintId } = req.params;
  
  const sprint = await Sprint.findById(sprintId).populate('tasks');
  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  const tasks = sprint.tasks;
  const totalCounts = tasks.length;
  const completedCounts = tasks.filter(t => t.status === 'done').length;

  const types = tasks.reduce((acc, task) => {
    acc[task.type] = (acc[task.type] || 0) + 1;
    return acc;
  }, {});

  const result = {
    total: totalCounts,
    completed: completedCounts,
    completionPercentage: totalCounts > 0 ? (completedCounts / totalCounts) * 100 : 0,
    byType: types
  };

  apiResponse(res, 200, true, result, 'Completion stats fetched successfully');
};
