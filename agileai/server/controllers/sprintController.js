import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getSprints = async (req, res) => {
  const { projectId } = req.query;

  if (!projectId) {
    return apiResponse(res, 400, false, null, 'projectId query parameter is required');
  }

  const sprints = await Sprint.find({ project: projectId })
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
    project: projectId,
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
  await Task.updateMany({ sprint: sprint._id }, { $set: { sprint: null } });
  
  await Sprint.findByIdAndDelete(req.params.id);

  apiResponse(res, 200, true, null, 'Sprint deleted successfully');
};

export const startSprint = async (req, res) => {
  const sprint = await Sprint.findById(req.params.id);

  if (!sprint) {
    return apiResponse(res, 404, false, null, 'Sprint not found');
  }

  sprint.status = 'active';
  sprint.startDate = new Date();
  await sprint.save();

  // Socket event will be handled inside socketService or emitted here
  const io = req.app.get('io');
  if (io) {
    io.to(`project:${sprint.project}`).emit('sprint:status_changed', sprint);
  }

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
  const incompleteTasks = sprint.tasks.filter((task) => task.status !== 'done');
  for (let task of incompleteTasks) {
    await Task.findByIdAndUpdate(task._id, { sprint: null });
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${sprint.project}`).emit('sprint:status_changed', sprint);
  }

  apiResponse(res, 200, true, sprint, 'Sprint completed successfully');
};
