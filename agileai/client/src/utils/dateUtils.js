import { format, formatDistanceToNow, isPast } from 'date-fns';

export const formatDate = (dateString, formatStr = 'MMM dd, yyyy') => {
  if (!dateString) return '';
  return format(new Date(dateString), formatStr);
};

export const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
};

export const isOverdue = (dateString) => {
  if (!dateString) return false;
  return isPast(new Date(dateString));
};
