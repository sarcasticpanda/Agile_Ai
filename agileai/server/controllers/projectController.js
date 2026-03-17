import Project from '../models/Project.model.js';
import User from '../models/User.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getProjects = async (req, res) => {
  const projects = await Project.find({
    $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
  }).populate('owner', 'name email avatar').populate('members.user', 'name avatar role');

  apiResponse(res, 200, true, projects, 'Projects fetched successfully');
};

export const createProject = async (req, res) => {
  const { title, description, color, organizationId } = req.body;

  const project = await Project.create({
    title,
    description,
    color,
    organization: organizationId || null,
    owner: req.user._id,
    members: [{ user: req.user._id, role: 'pm' }],
  });

  apiResponse(res, 201, true, project, 'Project created successfully');
};

export const getProjectById = async (req, res) => {
  const project = await Project.findById(req.params.id)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar role');

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  // Check membership
  const isMember = project.members.some(
    (member) => member.user._id.toString() === req.user._id.toString()
  );
  if (!isMember && project.owner._id.toString() !== req.user._id.toString()) {
    return apiResponse(res, 403, false, null, 'Not authorized to view this project');
  }

  apiResponse(res, 200, true, project, 'Project fetched successfully');
};

export const updateProject = async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  const updatedProject = await Project.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );

  apiResponse(res, 200, true, updatedProject, 'Project updated successfully');
};

export const deleteProject = async (req, res) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  project.status = 'archived';
  await project.save();

  apiResponse(res, 200, true, null, 'Project archived successfully');
};

export const getMembers = async (req, res) => {
  const project = await Project.findById(req.params.id).populate(
    'members.user',
    'name email avatar role'
  );

  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  apiResponse(res, 200, true, project.members, 'Members fetched successfully');
};

export const addMember = async (req, res) => {
  const { email, role } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return apiResponse(res, 404, false, null, 'User not found');
  }

  const project = await Project.findById(req.params.id);
  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  // Check if member already exists
  const isMember = project.members.some((m) => m.user.toString() === user._id.toString());
  if (isMember) {
    return apiResponse(res, 400, false, null, 'User is already a member');
  }

  project.members.push({ user: user._id, role: role || 'developer' });
  await project.save();

  apiResponse(res, 200, true, project.members, 'Member added successfully');
};

export const removeMember = async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    return apiResponse(res, 404, false, null, 'Project not found');
  }

  project.members = project.members.filter(
    (m) => m.user.toString() !== req.params.uid
  );
  await project.save();

  apiResponse(res, 200, true, project.members, 'Member removed successfully');
};
