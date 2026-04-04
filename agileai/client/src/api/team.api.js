import api from './axiosInstance';

// Team Management API (PM specific, re-mapped to /api/pm per AGILEAI_MASTER_BLUEPRINT)

export const createDeveloper = (data) => {
  return api.post('/pm/create-developer', data);
}

export const getMyRoster = () => {
  return api.get('/pm/my-developers');
};

export const getFreePool = async () => {
  // Get unassigned active developers from PM-accessible free-pool endpoint
  const res = await api.get('/pm/free-pool');
  return res;
};

export const claimDeveloper = (id, data) => {
  return api.patch(`/pm/developers/${id}/claim`, data);
};

export const releaseDeveloper = (id) => {
  return api.patch(`/pm/developers/${id}/release`);
};