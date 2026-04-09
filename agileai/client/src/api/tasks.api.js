import axiosInstance from './axiosInstance';

export const getTasks = async ({ projectId, sprintId }) => {
  let url = `/tasks?`;
  if (projectId) url += `projectId=${projectId}&`;
  if (sprintId) url += `sprintId=${sprintId}`;
  
  const response = await axiosInstance.get(url);
  return response.data;
};

export const createTask = async (data) => {
  const response = await axiosInstance.post('/tasks', data);
  return response.data;
};

export const getTaskById = async (id) => {
  const response = await axiosInstance.get(`/tasks/${id}`);
  return response.data;
};

export const updateTask = async ({ id, data }) => {
  const response = await axiosInstance.patch(`/tasks/${id}`, data);
  return response.data;
};

export const previewAssignmentWarnings = async (data) => {
  const response = await axiosInstance.post('/tasks/assignment-warning', data);
  return response.data;
};

export const deleteTask = async (id) => {
  const response = await axiosInstance.delete(`/tasks/${id}`);
  return response.data;
};

export const updateTaskStatus = async ({ id, status }) => {
  const response = await axiosInstance.patch(`/tasks/${id}/status`, { status });
  return response.data;
};

export const updateTaskSprint = async ({ id, sprintId }) => {
  const response = await axiosInstance.patch(`/tasks/${id}/sprint`, { sprintId });
  return response.data;
};

export const updateTaskOrder = async ({ id, order }) => {
  const response = await axiosInstance.patch(`/tasks/${id}/order`, { order });
  return response.data;
};

export const addComment = async ({ id, text }) => {
  const response = await axiosInstance.post(`/tasks/${id}/comment`, { text });
  return response.data;
};

export const deleteComment = async ({ id, cid }) => {
  const response = await axiosInstance.delete(`/tasks/${id}/comment/${cid}`);
  return response.data;
};

export const addWorklog = async ({ id, data }) => {
  const response = await axiosInstance.post(`/tasks/${id}/worklog`, data);
  return response.data;
};

export const startWorklogTimer = async ({ id, data }) => {
  const response = await axiosInstance.post(`/tasks/${id}/worklog/start`, data || {});
  return response.data;
};

export const stopWorklogTimer = async ({ id, data }) => {
  const response = await axiosInstance.post(`/tasks/${id}/worklog/stop`, data || {});
  return response.data;
};

export const deleteWorklog = async ({ id, wid }) => {
  const response = await axiosInstance.delete(`/tasks/${id}/worklog/${wid}`);
  return response.data;
};
