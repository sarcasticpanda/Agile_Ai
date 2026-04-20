import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as tasksApi from '../api/tasks.api';
import { toast } from '../components/ui/Toast';

export const useTask = (projectId, sprintId) => {
  const queryClient = useQueryClient();

  const invalidateAnalyticsQueries = (targetSprintId = sprintId) => {
    queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] });
    queryClient.invalidateQueries({ queryKey: ['velocity', projectId] });
    queryClient.invalidateQueries({ queryKey: ['teamStats', projectId] });
    queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    if (targetSprintId) {
      queryClient.invalidateQueries({ queryKey: ['burndown', targetSprintId] });
      queryClient.invalidateQueries({ queryKey: ['teamStats', projectId, targetSprintId] });
    }
  };

  const tasksQuery = useQuery({
    queryKey: ['tasks', projectId, sprintId],
    queryFn: () => tasksApi.getTasks({ projectId, sprintId }),
    enabled: !!projectId,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const createTaskMutation = useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      invalidateAnalyticsQueries();
      toast.success('Task created successfully');
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: tasksApi.updateTaskStatus,
    onSuccess: (data, variables) => {
      const targetSprintId = variables?.sprintId || sprintId;
      
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      if (targetSprintId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId, targetSprintId] });
        queryClient.invalidateQueries({ queryKey: ['burndown', targetSprintId] });
      }
      invalidateAnalyticsQueries(targetSprintId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      invalidateAnalyticsQueries();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: tasksApi.updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      if (sprintId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', projectId, sprintId] });
        queryClient.invalidateQueries({ queryKey: ['burndown', sprintId] });
      }
      invalidateAnalyticsQueries();
    },
  });

  return {
    tasks: tasksQuery.data?.data || [],
    isLoading: tasksQuery.isLoading,
    createTask: createTaskMutation.mutateAsync,
    updateTaskStatus: updateTaskStatusMutation.mutateAsync,
    updateTask: updateTaskMutation.mutateAsync,
  };
};
