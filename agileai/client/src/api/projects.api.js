import axiosInstance from './axiosInstance';

export const getProjects = async () => {
  const response = await axiosInstance.get('/projects');
  return response.data;
};

export const getProjectById = async (id) => {
  const response = await axiosInstance.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (data) => {
  const response = await axiosInstance.post('/projects', data);
  return response.data;
};

export const updateProject = async ({ id, data }) => {
  const response = await axiosInstance.patch(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id) => {
  const response = await axiosInstance.delete(`/projects/${id}`);
  return response.data;
};

export const getProjectMembers = async (id) => {
  const response = await axiosInstance.get(`/projects/${id}/members`);
  return response.data;
};

export const addProjectMember = async ({ id, data }) => {
  const response = await axiosInstance.post(`/projects/${id}/members`, data);
  return response.data;
};

export const removeProjectMember = async ({ id, uid }) => {
  const response = await axiosInstance.delete(`/projects/${id}/members/${uid}`);
  return response.data;
};
