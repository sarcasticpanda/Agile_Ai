import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useProjectStore = create(
  persist(
    (set) => ({
      activeProject: null,
      setActiveProject: (project) => set({ activeProject: project }),
      clearActiveProject: () => set({ activeProject: null }),
    }),
    {
      name: 'agileai-project-storage',
    }
  )
);

export default useProjectStore;
