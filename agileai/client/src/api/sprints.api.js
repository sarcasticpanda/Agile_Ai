import axiosInstance from './axiosInstance';

export const getSprints = async (projectId) => {
  const url = projectId ? `/sprints?projectId=${projectId}` : `/sprints`;
  const response = await axiosInstance.get(url);
  return response.data;
};

export const getSprintById = async (id) => {
  const response = await axiosInstance.get(`/sprints/${id}`);
  return response.data;
};

export const createSprint = async (data) => {
  const response = await axiosInstance.post('/sprints', data);
  return response.data;
};

export const updateSprint = async ({ id, data }) => {
  const response = await axiosInstance.patch(`/sprints/${id}`, data);
  return response.data;
};

export const deleteSprint = async (id) => {
  const response = await axiosInstance.delete(`/sprints/${id}`);
  return response.data;
};

export const startSprint = async (id) => {
  const response = await axiosInstance.post(`/sprints/${id}/start`);
  return response.data;
};

export const completeSprint = async (id) => {
  const response = await axiosInstance.post(`/sprints/${id}/complete`);
  return response.data;
};
