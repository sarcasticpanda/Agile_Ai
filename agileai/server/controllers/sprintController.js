import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import Project from '../models/Project.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getSprints = async (req, res) => {
  const { projectId } = req.query;

  let query = {};
  
  if (req.user.role !== 'admin') {
    const userProjects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
    }).select('_id');
    const allowedIds = userProjects.map(p => p._id.toString());
    
    if (projectId && projectId !== 'undefined') {
      if (!allowedIds.includes(projectId)) {
        return apiResponse(res, 403, false, null, 'Access denied to this project');
      }
      query.projectId = projectId;
    } else {
      query.projectId = { $in: allowedIds };
    }
  } else if (projectId && projectId !== 'undefined') {
    query.projectId = projectId;
  }

  const sprints = await Sprint.find(query)
    .populate('tasks')
    .sort({ createdAt: -1 });

  apiResponse(res, 200, true, sprints, 'Sprints fetched successfully');
};

export const createSprint = async (req, res) => {
  const { title, goal, startDate, endDate, projectId } = req.body;

  const sprint = await Sprint.create({
    title,
    goal,
    startDate,
    endDate,
    projectId: projectId,
  });

  apiResponse(res, 201, true, sprint, 'Sprint created successfully');
};

export const getSprintById = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id).populate('tasks');

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  apiResponse(res, 200, true, sprint, 'Sprint fetched successfully');
};

export const updateSprint = async (req, res) => {
  let sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  sprint = await Sprint.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  );

  apiResponse(res, 200, true, sprint, 'Sprint updated successfully');
};

export const deleteSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  // Remove sprint reference from tasks
  await Task.updateMany({ sprintId: sprint._id }, { $set: { sprintId: null } });
  
  await Sprint.findByIdAndDelete(req.params.id);

  apiResponse(res, 200, true, null, 'Sprint deleted successfully');
};

export const startSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  // Check if sprint is already active or completed
  if (sprint.status === 'active') {
    return apiResponse(res, 400, false, null, 'Sprint is already active');
  }
  if (sprint.status === 'completed') {
    return apiResponse(res, 400, false, null, 'Sprint is already completed');
  }

  sprint.status = 'active';
  sprint.startDate = new Date();
  await sprint.save();

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${sprint.projectId}`).emit('sprint:status_changed', sprint);
  }

  // ✅ CRITICAL FIX: Was missing apiResponse — caused frontend to hang forever
  apiResponse(res, 200, true, sprint, 'Sprint started successfully');
};

export const completeSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id).populate('tasks');

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  // Calculate velocity (sum of story points for completed tasks)
  const completedPoints = sprint.tasks
    .filter((task) => task.status === 'done')
    .reduce((total, task) => total + task.storyPoints, 0);

  const totalPoints = sprint.tasks.reduce((total, task) => total + task.storyPoints, 0);

  sprint.status = 'completed';
  sprint.endDate = new Date();
  sprint.velocity = completedPoints;
  sprint.completedStoryPoints = completedPoints;
  sprint.totalStoryPoints = totalPoints;

  await sprint.save();

  // Move incomplete tasks back to backlog
  const incompleteTasks = sprint.tasks.filter((task) => task.status.toLowerCase() !== 'done');
  for (let task of incompleteTasks) {
    await Task.findByIdAndUpdate(task._id, { sprintId: null });
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${sprint.projectId}`).emit('sprint:status_changed', sprint);
  }
  apiResponse(res, 200, true, sprint, 'Sprint completed successfully');
};
