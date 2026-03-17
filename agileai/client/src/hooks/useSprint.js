import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as sprintsApi from '../api/sprints.api';
import { toast } from '../components/ui/Toast';

export const useSprint = (projectId) => {
  const queryClient = useQueryClient();

  const sprintsQuery = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.getSprints(projectId),
    enabled: !!projectId,
  });

  const createSprintMutation = useMutation({
    mutationFn: sprintsApi.createSprint,
    onSuccess: () => {
      queryClient.invalidateQueries(['sprints', projectId]);
      toast.success('Sprint created successfully');
    },
    onError: (error) => toast.error(error?.response?.data?.message || 'Failed to create sprint'),
  });

  const startSprintMutation = useMutation({
    mutationFn: sprintsApi.startSprint,
    onSuccess: () => {
      queryClient.invalidateQueries(['sprints', projectId]);
      toast.success('Sprint started');
    },
  });

  const completeSprintMutation = useMutation({
    mutationFn: sprintsApi.completeSprint,
    onSuccess: () => {
      queryClient.invalidateQueries(['sprints', projectId]);
      toast.success('Sprint completed');
    },
  });

  return {
    sprints: sprintsQuery.data?.data || [],
    isLoading: sprintsQuery.isLoading,
    createSprint: createSprintMutation.mutateAsync,
    startSprint: startSprintMutation.mutateAsync,
    completeSprint: completeSprintMutation.mutateAsync,
  };
};
