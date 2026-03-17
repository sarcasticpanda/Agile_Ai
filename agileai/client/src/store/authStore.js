import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (userData, token, refreshToken) => set({ user: userData, token, refreshToken, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
      setToken: (token) => set({ token }),
      updateUser: (userData) => set({ user: userData }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

export default useAuthStore;
