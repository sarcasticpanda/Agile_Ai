import axiosInstance from './axiosInstance';

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

// GET /api/ai/sprint-risk/:sprintId — for PM dashboard risk badge
export const getSprintRisk = async (sprintId) => {
  const response = await axiosInstance.get(`/ai/sprint-risk/${sprintId}`);
  return response.data;
};

// GET /api/ai/burnout/:userId — for dev dashboard burnout badge
export const getBurnout = async (userId) => {
  const response = await axiosInstance.get(`/ai/burnout/${userId}`);
  return response.data;
};

