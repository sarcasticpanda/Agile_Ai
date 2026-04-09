import axiosInstance from './axiosInstance';

export const getOverview = async (pmId) => {
  const query = pmId ? `?pmId=${encodeURIComponent(pmId)}` : '';
  const response = await axiosInstance.get(`/analytics/overview${query}`);
  return response.data;
};

export const getOverviewPms = async () => {
  const response = await axiosInstance.get('/analytics/overview/pms');
  return response.data;
};

export const getBurndownData = async (sprintId) => {
  const response = await axiosInstance.get(`/analytics/burndown/${sprintId}`);
  return response.data;
};

export const getVelocityData = async (projectId) => {
  const response = await axiosInstance.get(`/analytics/velocity/${projectId}`);
  return response.data;
};

export const getTeamStats = async (projectId, sprintId) => {
  const query = sprintId ? `?sprintId=${sprintId}` : '';
  const response = await axiosInstance.get(`/analytics/team/${projectId}${query}`);
  return response.data;
};

export const getCompletionStats = async (sprintId) => {
  const response = await axiosInstance.get(`/analytics/completion/${sprintId}`);
  return response.data;
};
