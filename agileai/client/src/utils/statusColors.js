export const getTaskStatusColor = (status) => {
  const colors = {
    'To Do': 'bg-slate-100 text-slate-700 border-slate-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    'In Review': 'bg-purple-100 text-purple-700 border-purple-200',
    'Done': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return colors[status] || colors['To Do'];
};

export const getTaskPriorityColor = (priority) => {
  const colors = {
    'Low': 'text-blue-500 bg-blue-50',
    'Medium': 'text-amber-500 bg-amber-50',
    'High': 'text-orange-500 bg-orange-50',
    'Urgent': 'text-red-600 bg-red-50',
  };
  return colors[priority] || colors['Medium'];
};

export const getSprintStatusColor = (status) => {
  const colors = {
    'Planning': 'primary',
    'Active': 'success',
    'Completed': 'default',
  };
  return colors[status] || 'default';
};
