import axiosInstance from './axiosInstance';

export const getBurndownData = async (sprintId) => {
  const response = await axiosInstance.get(`/analytics/burndown/${sprintId}`);
  return response.data;
};

export const getVelocityData = async (projectId) => {
  const response = await axiosInstance.get(`/analytics/velocity/${projectId}`);
  return response.data;
};

export const getTeamStats = async (projectId) => {
  const response = await axiosInstance.get(`/analytics/team/${projectId}`);
  return response.data;
};

export const getCompletionStats = async (sprintId) => {
  const response = await axiosInstance.get(`/analytics/completion/${sprintId}`);
  return response.data;
};
