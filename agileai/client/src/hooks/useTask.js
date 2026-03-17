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
    // Optimistic updates happen in the component or via socket, just refetch
    onSettled: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: tasksApi.updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', projectId]);
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
