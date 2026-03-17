import { create } from 'zustand';

const useUiStore = create((set) => ({
  isSidebarOpen: true,
  activeProject: null,
  activeSprint: null,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setActiveProject: (projectId) => set({ activeProject: projectId }),
  setActiveSprint: (sprintId) => set({ activeSprint: sprintId }),
}));

export default useUiStore;
