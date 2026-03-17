export const canManageProject = (role) => {
  return ['admin', 'project_manager'].includes(role);
};

export const canManageSprint = (role) => {
  return ['admin', 'project_manager'].includes(role);
};

export const canManageTeam = (role) => {
  return ['admin'].includes(role);
};

export const isAdmin = (role) => role === 'admin';
