import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import Task from '../models/Task.model.js';
import Sprint from '../models/Sprint.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getUsers = async (req, res) => {
  const users = await User.find({}).select('-password');
  apiResponse(res, 200, true, users, 'Users fetched successfully');
};

export const updateUserRole = async (req, res) => {
  const { role, isActive } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    return apiResponse(res, 404, false, null, 'User not found');
  }

  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();
  
  const updatedUser = await User.findById(user._id).select('-password');
  apiResponse(res, 200, true, updatedUser, 'User updated successfully');
};

export const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return apiResponse(res, 404, false, null, 'User not found');
  }
  
  user.isActive = false; // Soft delete
  await user.save();
  
  apiResponse(res, 200, true, null, 'User deactivated successfully');
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
