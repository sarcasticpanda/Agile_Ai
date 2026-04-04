import User from '../models/User.model.js';
import AuditLog from '../models/AuditLog.model.js';
import Project from '../models/Project.model.js';
import Task from '../models/Task.model.js';
import Sprint from '../models/Sprint.model.js';

// @desc    Get current PM's team roster
// @route   GET /api/v1/team/roster
// @access  Private/PM
export const getMyRoster = async (req, res) => {
  try {
    const developers = await User.find({
      role: 'developer',
      status: 'active',
      managedBy: req.user._id
    }).select('-password');

    const enrichedDevs = await Promise.all(developers.map(async (dev) => {
      const projectCount = await Project.countDocuments({ 'members.user': dev._id });
      // Number of sprints where the developer has at least one task assigned
      const assignedTasks = await Task.find({ assignee: dev._id });
      const sprintIds = [...new Set(assignedTasks.map(t => t.sprint?.toString()).filter(Boolean))];
      const sprintCount = sprintIds.length;

      return {
        ...dev.toObject(),
        projectCount,
        sprintCount
      };
    }));

    res.status(200).json({
      success: true,
      data: enrichedDevs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching roster' });
  }
};

// @desc    Get unassigned active developers
// @route   GET /api/v1/team/free-pool
// @access  Private/PM
export const getFreePool = async (req, res) => {
  try {
    const freeDevelopers = await User.find({
      role: 'developer',
      status: 'active',
      managedBy: null
    }).select('-password');

    const enrichedPool = await Promise.all(freeDevelopers.map(async (dev) => {
      const projectCount = await Project.countDocuments({ 'members.user': dev._id });
      const assignedTasks = await Task.find({ assignee: dev._id });
      const sprintIds = [...new Set(assignedTasks.map(t => t.sprint?.toString()).filter(Boolean))];
      const sprintCount = sprintIds.length;

      return {
        ...dev.toObject(),
        projectCount,
        sprintCount
      };
    }));

    res.status(200).json({
      success: true,
      data: enrichedPool
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error fetching free pool' });
  }
};

// @desc    Claim an unassigned developer
// @route   POST /api/v1/team/claim/:id
// @access  Private/PM
export const claimDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);

    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    if (developer.role !== 'developer') {
      return res.status(400).json({ success: false, message: 'Can only claim developers' });
    }

    if (developer.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Cannot claim inactive developers' });
    }

    if (developer.managedBy) {
      return res.status(400).json({ success: false, message: 'Developer is already assigned to a manager' });
    }

    const oldState = { managedBy: developer.managedBy };

    developer.managedBy = req.user._id;
    await developer.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'USER_ASSIGNED',
      resource: 'User',
      resourceId: developer._id,
      before: oldState,
      after: { managedBy: developer.managedBy },
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: developer,
      message: 'Developer successfully claimed'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error claiming developer' });
  }
};

// @desc    Release a developer from team
// @route   POST /api/v1/team/release/:id
// @access  Private/PM
export const releaseDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);

    if (!developer) {
      return res.status(404).json({ success: false, message: 'Developer not found' });
    }

    // Ensure the PM only releases developers assigned to them
    if (developer.managedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Developer is not assigned to your team' });
    }

    const oldState = { managedBy: developer.managedBy };

    developer.managedBy = null;
    await developer.save();

    await AuditLog.create({
      user: req.user._id,
      action: 'USER_FREED',
      resource: 'User',
      resourceId: developer._id,
      before: oldState,
      after: { managedBy: null },
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: developer,
      message: 'Developer successfully released to free pool'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error releasing developer' });
  }
};
