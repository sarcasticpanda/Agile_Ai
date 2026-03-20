import Sprint from '../models/Sprint.model.js';
import Task from '../models/Task.model.js';
import Project from '../models/Project.model.js';

export const calculateBurndown = async (sprintId) => {
  const sprint = await Sprint.findById(sprintId).populate('tasks');
  if (!sprint) throw new Error('Sprint not found');

  const tasks = sprint.tasks;
  const totalPoints = tasks.reduce((sum, task) => sum + task.storyPoints, 0);

  // Simplified: ideal line uses uniform distribution over sprint duration
  const sprintStart = new Date(sprint.startDate || sprint.createdAt);
  const sprintEnd = new Date(sprint.endDate || new Date(sprintStart.getTime() + 14 * 24 * 60 * 60 * 1000)); // Default 2 weeks

  const daysDuration = Math.ceil((sprintEnd - sprintStart) / (1000 * 60 * 60 * 24));
  const burndownData = [];

  let currentPoints = totalPoints;

  // Generate data points
  for (let i = 0; i <= daysDuration; i++) {
    const currentDate = new Date(sprintStart.getTime() + i * 24 * 60 * 60 * 1000);
    currentDate.setHours(23, 59, 59, 999); // end of day

    // Calculate completed on this day
    const completedTasksOnDay = tasks.filter((t) => {
      // In a real app we'd track status changes in AuditLog, but here we just approximate using updatedAt
      // if task is done and it was last updated before current day end
      return t.status === 'done' && new Date(t.updatedAt) <= currentDate;
    });

    const completedPoints = completedTasksOnDay.reduce((sum, t) => sum + t.storyPoints, 0);
    const idealPoints = Math.max(0, totalPoints - (totalPoints / daysDuration) * i);

    burndownData.push({
      date: currentDate.toISOString().split('T')[0],
      ideal: parseFloat(idealPoints.toFixed(1)),
      actual: totalPoints - completedPoints,
    });

    // If actual date is beyond today, don't project actuals forward (except first point)
    if (currentDate > new Date() && i > 0) {
      burndownData[i].actual = null;
    }
  }

  return {
    sprintId: sprint._id,
    totalStoryPoints: totalPoints,
    data: burndownData,
  };
};

export const calculateVelocity = async (projectId) => {
  // Get last 6 completed sprints
  const sprints = await Sprint.find({ 
    project: projectId, 
    status: 'completed' 
  })
    .sort({ endDate: -1 })
    .limit(6);

  const velocityData = sprints.reverse().map((s) => ({
    sprintName: s.title,
    completed: s.velocity || 0,
    planned: s.totalStoryPoints || 0,
  }));

  const averageVelocity =
    velocityData.length > 0
      ? velocityData.reduce((sum, s) => sum + s.completed, 0) / velocityData.length
      : 0;

  return {
    averageVelocity: Math.round(averageVelocity),
    data: velocityData,
  };
};

export const calculateTeamStats = async (projectId) => {
  const project = await Project.findById(projectId).populate('members.user', 'name avatar role');
  if (!project) throw new Error('Project not found');

  const tasks = await Task.find({ project: projectId });

  const teamStats = project.members.map((member) => {
    const userTasks = tasks.filter(
      (t) => t.assignee && t.assignee.toString() === member.user._id.toString()
    );
    
    const completedTasks = userTasks.filter((t) => t.status === 'done');

    const totalPoints = userTasks.reduce((sum, t) => sum + t.storyPoints, 0);
    const completedPoints = completedTasks.reduce((sum, t) => sum + t.storyPoints, 0);

    return {
      user: member.user,
      tasksAssigned: userTasks.length,
      tasksCompleted: completedTasks.length,
      storyPoints: totalPoints,
      completedStoryPoints: completedPoints,
      completionRate: userTasks.length > 0 ? (completedTasks.length / userTasks.length) * 100 : 0,
    };
  });

  return teamStats;
};
