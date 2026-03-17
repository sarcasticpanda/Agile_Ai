import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth.api';
import useAuthStore from '../store/authStore';

export const useAuth = () => {
  const queryClient = useQueryClient();
  const { login: storeLogin, logout: storeLogout } = useAuthStore();

  const extractUserAndLogin = (data) => {
    if (data.success && data.data) {
      const { token, refreshToken, ...userData } = data.data;
      storeLogin(userData, token, refreshToken);
    }
  };

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: extractUserAndLogin,
  });

  const registerMutation = useMutation({
    mutationFn: authApi.registerUser,
    onSuccess: extractUserAndLogin,
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logoutUser,
    onSettled: () => {
      storeLogout();
      queryClient.clear();
      window.location.href = '/login';
    },
  });

  return {
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoading: loginMutation.isPending || registerMutation.isPending || logoutMutation.isPending,
  };
};

