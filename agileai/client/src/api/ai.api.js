import axiosInstance from './axiosInstance';

// Phase 1: These endpoints currently return mock data from the backend.
// In Phase 2, the backend will proxy these requests to the Python AI service.

export const predictSprintRisk = async (sprintId) => {
  const response = await axiosInstance.post('/ai/predict-risk', { sprintId });
  return response.data;
};

export const estimateTaskEffort = async (taskId) => {
  const response = await axiosInstance.post('/ai/estimate-effort', { taskId });
  return response.data;
};

export const getSprintInsights = async (sprintId) => {
  const response = await axiosInstance.get(`/ai/insights/${sprintId}`);
  return response.data;
};
