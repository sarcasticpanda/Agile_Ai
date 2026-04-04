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

  // If the user was a PM, release their assigned developers back to the pool
  await User.updateMany(
    { managedBy: user._id },
    { $set: { managedBy: null } }
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

export const getProjectsOverview = async (req, res) => {
  const projects = await Project.find({})
    .populate('owner', 'name email avatar role')
    .populate('members.user', 'name email avatar role')
    .sort({ updatedAt: -1 });

  // Enrich with task and sprint counts
  const enriched = await Promise.all(projects.map(async (project) => {
    const taskCount = await Task.countDocuments({ project: project._id });
    const sprintCount = await Sprint.countDocuments({ projectId: project._id });
    const activeSprints = await Sprint.countDocuments({ projectId: project._id, status: 'active' });
    return {
      _id: project._id,
      title: project.title,
      key: project.key,
      description: project.description,
      color: project.color,
      status: project.status,
      owner: project.owner,
      members: project.members,
      memberCount: project.members.length,
      taskCount,
      sprintCount,
      activeSprints,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }));

  apiResponse(res, 200, true, enriched, 'Projects overview fetched');
};

export const getHierarchyOverview = async (req, res) => {
  try {
    const pms = await User.find({ role: 'pm' }).select('name email avatar status');
    const allDevs = await User.find({ role: 'developer' }).select('name email avatar status managedBy');
    const projects = await Project.find().populate('members.user', 'name role').populate('owner', 'name role');
    const sprints = await Sprint.find();
    const tasks = await Task.find({ status: { $ne: 'done' } }).populate('assignee', 'name avatar');
    
    const tree = pms.map(pm => {
      const managedDevs = allDevs.filter(d => d.managedBy?.toString() === pm._id.toString());
      const ownedProjects = projects.filter(p => p.owner?._id.toString() === pm._id.toString());
      
      const enrichedProjects = ownedProjects.map(proj => {
        const projSprints = sprints.filter(s => s.projectId.toString() === proj._id.toString());
        const enrichedSprints = projSprints.map(s => {
          const sprintTasks = tasks.filter(t => t.sprint?.toString() === s._id.toString());
          return {
            ...s.toObject(),
            tasks: sprintTasks
          };
        });
        return {
          ...proj.toObject(),
          sprints: enrichedSprints
        };
      });

      return {
        _id: pm._id,
        name: pm.name,
        email: pm.email,
        status: pm.status,
        devs: managedDevs,
        projects: enrichedProjects
      };
    });

    apiResponse(res, 200, true, tree, 'Hierarchy fetched successfully');
  } catch (error) {
    console.error('Hierarchy Error:', error);
    apiResponse(res, 500, false, null, 'Error fetching hierarchy');
  }
};

export const getActivityLogs = async (req, res) => {
  try {
    const auditLogs = await AuditLog.find().populate('user', 'name role').sort({ createdAt: -1 }).limit(100);
    apiResponse(res, 200, true, auditLogs, 'Activity Logs fetched');
  } catch (error) {
    console.error('Activity Logs Error:', error);
    apiResponse(res, 500, false, null, 'Error fetching logs');
  }
};

export const getPendingUsers = async (req, res) => {
  try {
    const pending = await User.find({ status: 'pending' }).select('-password').sort({ createdAt: -1 });
    apiResponse(res, 200, true, pending, 'Pending users fetched');
  } catch (error) {
    console.error('Pending Users Error:', error);
    apiResponse(res, 500, false, null, 'Error fetching pending users');
  }
};

export const getAdminFreePool = async (req, res) => {
  try {
    const unassigned = await User.find({ status: 'active', managedBy: null, role: { $in: ['developer', 'pm'] } }).select('-password');
    apiResponse(res, 200, true, unassigned, 'Free pool fetched');
  } catch (error) {
    console.error('Admin Free Pool Error:', error);
    apiResponse(res, 500, false, null, 'Error fetching free pool for admin');
  }
};
