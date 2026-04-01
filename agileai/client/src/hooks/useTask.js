import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as tasksApi from '../api/tasks.api';
import { toast } from '../components/ui/Toast';

export const useTask = (projectId, sprintId) => {
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    queryKey: ['tasks', projectId, sprintId],
    queryFn: () => tasksApi.getTasks({ projectId, sprintId }),
    enabled: !!projectId,
  });

  const createTaskMutation = useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
      toast.success('Task created successfully');
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: tasksApi.updateTaskStatus,
    // Fixed by @DataState — ensure Kanban board and burndown charts refresh
    onSuccess: (data, variables) => {
      const { sprintId } = variables; // Assuming tasksApi.updateTaskStatus was called with { id, status, sprintId }
      // If sprintId isn't passed to the mutation, we might need it from the hook scope
      const targetSprintId = sprintId || variables.sprintId;
      
      queryClient.invalidateQueries(['tasks', projectId]);
      if (targetSprintId) {
        queryClient.invalidateQueries(['tasks', projectId, targetSprintId]);
        queryClient.invalidateQueries(['burndown', targetSprintId]);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: tasksApi.updateTask,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['tasks', projectId]);
      // Fixed by @DataState — refetch specific sprint/burndown if relevant
      if (sprintId) {
        queryClient.invalidateQueries(['tasks', projectId, sprintId]);
        queryClient.invalidateQueries(['burndown', sprintId]);
      }
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
