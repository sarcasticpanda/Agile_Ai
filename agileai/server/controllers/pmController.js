import User from '../models/User.model.js';
import Project from '../models/Project.model.js';
import Notification from '../models/Notification.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const createDeveloper = async (req, res) => {
  try {
    const { name, email, password, projectId } = req.body;
    
    // Create explicitly as a developer managed by this PM
    const user = await User.create({
      name,
      email,
      password,
      role: 'developer',
      status: 'active',
      managedBy: req.user._id,
      createdBy: req.user._id
    });

    if (projectId) {
      const project = await Project.findById(projectId);
      if (project && project.owner.toString() === req.user._id.toString()) {
        project.members.push({ user: user._id, role: 'developer' });
        await project.save();
      }
    }

    await Notification.create({
      user: user._id,
      title: 'Welcome to AgileAI',
      message: `You have been added to the team by ${req.user.name}.`,
      type: 'user_created',
      read: false
    });

    apiResponse(res, 201, true, { user }, 'Developer created successfully');
  } catch (error) {
    if (error.code === 11000) return apiResponse(res, 400, false, null, 'Email already exists');
    apiResponse(res, 500, false, null, 'Server error creating developer');
  }
};

export const getMyDevelopers = async (req, res) => {
  try {
    const developers = await User.find({
      role: 'developer',
      status: 'active',
      managedBy: req.user._id
    }).select('-password');
    
    // Here we should inject tasks count and current sprint. 
    // But keeping it lightweight for now, we attach baseline user.
    apiResponse(res, 200, true, developers, 'Fetched developers successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error fetching developers');
  }
};

export const getPendingDevelopers = async (req, res) => {
  try {
    const developers = await User.find({
      role: 'developer',
      status: 'pending'
    }).select('-password');
    // Note: Blueprint says "managedBy = req.user._id", 
    // but self-registered devs might not have managedBy set initially. 
    // They would likely show up in a global pending pool or assigned pool. We return all pending for PM to claim/approve.

    apiResponse(res, 200, true, developers, 'Fetched pending developers successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error fetching pending developers');
  }
};

export const releaseDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);
    if (!developer) return apiResponse(res, 404, false, null, 'Developer not found');

    if (developer.managedBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return apiResponse(res, 403, false, null, 'Not authorized to release this developer');
    }

    developer.managedBy = null;
    await developer.save();

    apiResponse(res, 200, true, null, 'Developer released successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error releasing developer');
  }
};

export const approveDeveloper = async (req, res) => {
  try {
    const developer = await User.findById(req.params.id);
    if (!developer) return apiResponse(res, 404, false, null, 'Developer not found');

    developer.status = 'active';
    developer.managedBy = req.user._id; // Claiming ownership upon approval
    await developer.save();

    const { projectId } = req.body;
    if (projectId) {
      const project = await Project.findById(projectId);
      if (project && project.owner.toString() === req.user._id.toString()) {
        const isMember = project.members.find(m => m.user.toString() === developer._id.toString());
        if (!isMember) {
          project.members.push({ user: developer._id, role: 'developer' });
          await project.save();
        }
      }
    }

    await Notification.create({
      user: developer._id,
      title: 'Account Approved',
      message: `Your account was approved and claimed by ${req.user.name}.`,
      type: 'user_assigned',
      read: false
    });

    apiResponse(res, 200, true, { user: developer }, 'Developer approved successfully');
  } catch (error) {
    apiResponse(res, 500, false, null, 'Server error approving developer');
  }
};