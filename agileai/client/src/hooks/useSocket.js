const refId = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && value._id != null) return String(value._id);
  return String(value);
};

/**
 * Invalidate React Query caches after a task-shaped payload from Socket.IO.
 */
export const invalidateCachesForTaskPayload = (queryClient, task) => {
  if (!task) return;
  const projectId = refId(task.project);
  const sprintId = refId(task.sprint);
  const taskId = refId(task._id ?? task.id);

  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    queryClient.invalidateQueries({ queryKey: ['velocity', projectId] });
    queryClient.invalidateQueries({ queryKey: ['teamStats', projectId] });
    queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] });
    queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
    queryClient.invalidateQueries({ queryKey: ['ai-insights-sprints', projectId] });
  }
  if (sprintId) {
    queryClient.invalidateQueries({ queryKey: ['burndown', sprintId] });
    queryClient.invalidateQueries({ queryKey: ['sprint-risk', sprintId] });
    queryClient.invalidateQueries({ queryKey: ['ai-insights', sprintId] });
  }
  if (taskId) {
    queryClient.invalidateQueries({ queryKey: ['task', taskId] });
  }
  queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
};

/**
 * Invalidate caches after sprint status / metadata updates.
 */
export const invalidateCachesForSprintPayload = (queryClient, sprint) => {
  if (!sprint) return;
  const projectId = refId(sprint.projectId);
  const sprintId = refId(sprint._id);

  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    queryClient.invalidateQueries({ queryKey: ['velocity', projectId] });
    queryClient.invalidateQueries({ queryKey: ['teamStats', projectId] });
    queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] });
    queryClient.invalidateQueries({ queryKey: ['ai-insights-sprints', projectId] });
  }
  if (sprintId) {
    queryClient.invalidateQueries({ queryKey: ['burndown', sprintId] });
    queryClient.invalidateQueries({ queryKey: ['sprint-risk', sprintId] });
    queryClient.invalidateQueries({ queryKey: ['ai-insights', sprintId] });
  }
};
