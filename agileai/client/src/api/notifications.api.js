import axiosInstance from './axiosInstance';

export const getNotifications = async () => {
  const response = await axiosInstance.get('/notifications');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await axiosInstance.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await axiosInstance.post('/notifications/read-all');
  return response.data;
};

export const deleteNotification = async (id) => {
  const response = await axiosInstance.delete(`/notifications/${id}`);
  return response.data;
};
