import Notification from '../models/Notification.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getNotifications = async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50); // reasonable limit for phase 1

  apiResponse(res, 200, true, notifications, 'Notifications fetched successfully');
};

export const markAsRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );

  if (!notification) {
    return apiResponse(res, 404, false, null, 'Notification not found');
  }

  apiResponse(res, 200, true, notification, 'Notification marked as read');
};

export const deleteNotification = async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!notification) {
    return apiResponse(res, 404, false, null, 'Notification not found');
  }

  apiResponse(res, 200, true, null, 'Notification deleted successfully');
};

export const markAllAsRead = async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, read: false },
    { read: true }
  );

  apiResponse(res, 200, true, null, 'All notifications marked as read');
};
