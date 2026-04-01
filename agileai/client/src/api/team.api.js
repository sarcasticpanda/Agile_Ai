import api from './axiosInstance';

// Team Management API (PM specific, re-mapped to /api/pm per AGILEAI_MASTER_BLUEPRINT)

export const createDeveloper = (data) => {
  return api.post('/pm/create-developer', data);
}

export const getMyRoster = () => {
  return api.get('/pm/my-developers');
};

export const getFreePool = () => {
  // Alias for PM fetching pending devs they map to, or unassigned devs globally
  return api.get('/pm/pending-developers');
};

export const claimDeveloper = (id, data) => {
  // In blueprint, claiming an unassigned user operates under approve 
  return api.patch(`/pm/developers/${id}/approve`, data);
};

export const releaseDeveloper = (id) => {
  return api.patch(`/pm/developers/${id}/release`);
};