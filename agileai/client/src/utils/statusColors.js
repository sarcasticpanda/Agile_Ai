export const getTaskStatusColor = (status) => {
  const s = (status || '').toString().toLowerCase();
  const colors = {
    todo: 'bg-slate-100 text-slate-700 border-slate-200',
    inprogress: 'bg-blue-100 text-blue-700 border-blue-200',
    review: 'bg-purple-100 text-purple-700 border-purple-200',
    done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  if (colors[s]) return colors[s];

  // Back-compat if any UI still passes title-cased labels
  const legacy = {
    'to do': colors.todo,
    'in progress': colors.inprogress,
    'in review': colors.review,
    done: colors.done,
  };
  return legacy[s] || colors.todo;
};

export const getTaskPriorityColor = (priority) => {
  const p = (priority || '').toString().toLowerCase();
  const colors = {
    low: 'text-blue-500 bg-blue-50',
    medium: 'text-amber-500 bg-amber-50',
    high: 'text-orange-500 bg-orange-50',
    critical: 'text-red-600 bg-red-50',
  };

  if (colors[p]) return colors[p];

  // Back-compat
  const legacy = {
    urgent: colors.critical,
  };
  return legacy[p] || colors.medium;
};

export const getSprintStatusColor = (status) => {
  const s = (status || '').toString().toLowerCase();
  const colors = {
    planning: 'primary',
    active: 'success',
    completed: 'default',
    cancelled: 'default',
  };
  if (colors[s]) return colors[s];

  // Back-compat
  const legacy = {
    planning: colors.planning,
    active: colors.active,
    completed: colors.completed,
    cancelled: colors.cancelled,
  };
  return legacy[s] || 'default';
};
