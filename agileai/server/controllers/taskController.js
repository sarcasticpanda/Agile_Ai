import Task from '../models/Task.model.js';
import Sprint from '../models/Sprint.model.js';
import Project from '../models/Project.model.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getTasks = async (req, res) => {
  const { sprintId, projectId } = req.query;

  let query = {};
  if (sprintId) {
    query.sprint = sprintId === 'backlog' ? null : sprintId;
  }
  if (projectId) query.project = projectId;

  const tasks = await Task.find(query)
    .populate('assignee', 'name avatar')
    .populate('reporter', 'name avatar')
    .sort({ order: 1, createdAt: -1 });

  apiResponse(res, 200, true, tasks, 'Tasks fetched successfully');
};

export const createTask = async (req, res) => {
  const task = await Task.create({
    ...req.body,
    reporter: req.user._id,
  });

  if (task.sprint) {
    await Sprint.findByIdAndUpdate(task.sprint, { $push: { tasks: task._id } });
  }

  apiResponse(res, 201, true, task, 'Task created successfully');
};

export const getTaskById = async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignee', 'name avatar')
    .populate('reporter', 'name avatar')
    .populate('comments.user', 'name avatar')
    .populate('worklogs.user', 'name avatar');

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  apiResponse(res, 200, true, task, 'Task fetched successfully');
};

export const updateTask = async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true }
  ).populate('assignee', 'name avatar');

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${task.project}`).emit('task:updated', task);
  }

  apiResponse(res, 200, true, task, 'Task updated successfully');
};

export const deleteTask = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  if (task.sprint) {
    await Sprint.findByIdAndUpdate(task.sprint, { $pull: { tasks: task._id } });
  }

  await Task.findByIdAndDelete(req.params.id);

  apiResponse(res, 200, true, null, 'Task deleted successfully');
};

export const updateTaskStatus = async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true }
  );

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`project:${task.project}`).emit('task:moved', task);
  }

  apiResponse(res, 200, true, task, 'Task status updated');
};

export const updateTaskSprint = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const oldSprint = task.sprint;
  const newSprint = req.body.sprintId;

  task.sprint = newSprint || null;
  await task.save();

  if (oldSprint) {
    await Sprint.findByIdAndUpdate(oldSprint, { $pull: { tasks: task._id } });
  }

  if (newSprint) {
    await Sprint.findByIdAndUpdate(newSprint, { $push: { tasks: task._id } });
  }

  apiResponse(res, 200, true, task, 'Task sprint updated');
};

export const reorderTask = async (req, res) => {
  const { order } = req.body;
  const task = await Task.findByIdAndUpdate(req.params.id, { order }, { new: true });

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  apiResponse(res, 200, true, task, 'Task reordered');
};

export const addComment = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const comment = {
    user: req.user._id,
    text: req.body.text,
  };

  task.comments.push(comment);
  await task.save();

  const populatedTask = await Task.findById(task._id).populate('comments.user', 'name avatar');
  const addedComment = populatedTask.comments[populatedTask.comments.length - 1];

  const io = req.app.get('io');
  if (io) {
    io.to(`task:${task._id}`).emit('comment:added', addedComment);
  }

  apiResponse(res, 200, true, addedComment, 'Comment added');
};

export const deleteComment = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const comment = task.comments.id(req.params.cid);
  
  if (!comment) {
    return apiResponse(res, 404, false, null, 'Comment not found');
  }

  if (comment.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return apiResponse(res, 403, false, null, 'Unauthorized to delete this comment');
  }

  task.comments.pull(req.params.cid);
  await task.save();

  apiResponse(res, 200, true, null, 'Comment deleted');
};

export const addWorklog = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const worklog = {
    user: req.user._id,
    hours: Number(req.body.hours),
    date: req.body.date || new Date(),
    description: req.body.description,
  };

  task.worklogs.push(worklog);
  await task.save(); // pre-save hook will update actualHours

  apiResponse(res, 200, true, task, 'Worklog added');
};

export const deleteWorklog = async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return apiResponse(res, 404, false, null, 'Task not found');
  }

  const worklog = task.worklogs.id(req.params.wid);
  
  if (!worklog) {
    return apiResponse(res, 404, false, null, 'Worklog not found');
  }

  if (worklog.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return apiResponse(res, 403, false, null, 'Unauthorized to delete this worklog');
  }

  task.worklogs.pull(req.params.wid);
  await task.save(); // pre-save hook will recalculate actualHours

  apiResponse(res, 200, true, task, 'Worklog deleted');
};
