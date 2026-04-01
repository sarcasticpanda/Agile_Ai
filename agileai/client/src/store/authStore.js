import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Fixed by @RoleAuth — ensure store persists all user fields and token
const useAuthStore = create(
  persist(
    (set) => ({
      user: null, // Should contain { _id, name, email, role }
      token: null,
      isAuthenticated: false,
      login: (userData, token, refreshToken) => set({ 
        user: userData, 
        token,
        refreshToken: refreshToken || null,
        isAuthenticated: true 
      }),
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('auth-storage');
      },
      updateUser: (userData) => set({ user: userData }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

export default useAuthStore;
