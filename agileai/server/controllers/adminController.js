import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import Task from '../models/Task.model.js';
import Sprint from '../models/Sprint.model.js';
import AuditLog from '../models/AuditLog.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getUsers = async (req, res) => {
  const users = await User.find({}).select('-password');
  apiResponse(res, 200, true, users, 'Users fetched successfully');
};

export const updateUserRole = async (req, res) => {
  const { role, isActive, status, managedBy } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    return apiResponse(res, 404, false, null, 'User not found');
  }

  // Capture original state for logging
  const oldState = {
    role: user.role,
    status: user.status,
    managedBy: user.managedBy,
    isActive: user.isActive
  };

  if (role) user.role = role;
  if (status) user.status = status;
  if (managedBy !== undefined) user.managedBy = managedBy;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  // Create an Audit Log if managedBy changed (assigned or freed)
  if (managedBy !== undefined && oldState.managedBy?.toString() !== managedBy) {
    await AuditLog.create({
      user: req.user._id, // the Admin performing the action
      action: managedBy === null ? 'USER_FREED' : 'USER_ASSIGNED',
      resource: 'User',
      resourceId: user._id,
      before: oldState,
      after: {
        role: user.role,
        status: user.status,
        managedBy: user.managedBy,
        isActive: user.isActive
      },
      ip: req.ip
    });
  }

  // Optional: Create an Audit Log if role or status changed
  if ((role && oldState.role !== role) || (status && oldState.status !== status)) {
    await AuditLog.create({
      user: req.user._id,
      action: 'USER_ACCOUNT_UPDATED',
      resource: 'User',
      resourceId: user._id,
      before: oldState,
      after: {
        role: user.role,
        status: user.status,
        managedBy: user.managedBy,
        isActive: user.isActive
      },
      ip: req.ip
    });
  }

  const updatedUser = await User.findById(user._id).select('-password');
  apiResponse(res, 200, true, updatedUser, 'User updated successfully');
};

export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return apiResponse(res, 404, false, null, 'User not found');
  }
  
  // Fixed by GSD: Task 8 - True deletion and cleanup
  await Project.updateMany(
    { 'members.user': user._id },
    { $pull: { members: { user: user._id } } }
  );

  await User.findByIdAndDelete(req.params.id);
  
  apiResponse(res, 200, true, null, 'User deleted successfully');
};

export const getStats = async (req, res) => {
  const userCount = await User.countDocuments();
  const projectCount = await Project.countDocuments();
  const taskCount = await Task.countDocuments();
  const sprintCount = await Sprint.countDocuments();

  apiResponse(res, 200, true, {
    users: userCount,
    projects: projectCount,
    tasks: taskCount,
    sprints: sprintCount
  }, 'System stats fetched successfully');
};

export const getLogs = async (req, res) => {
  const logs = await AuditLog.find({})
    .populate('user', 'name email role')
    .sort({ createdAt: -1 })
    .limit(100);
  apiResponse(res, 200, true, logs, 'System audit logs fetched successfully');
};

