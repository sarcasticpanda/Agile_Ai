import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../../store/authStore';
import useProjectStore from '../../store/projectStore';
import axiosInstance from '../../api/axiosInstance';

const resolveProjectId = (projectLike) =>
  typeof projectLike === 'string' ? projectLike : projectLike?._id || '';

export const PMLayout = () => {
  const { user, logout } = useAuthStore();
  const { activeProject, setActiveProject } = useProjectStore();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [projectName, setProjectName] = useState('');

  // Fetch all projects for the switcher
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/projects');
      return data;
    },
    staleTime: 30000,
  });
  const projects = projectsRes?.data || [];

  const storeProjectId = resolveProjectId(activeProject);
  const activeProjectId = params.projectId || storeProjectId;

  // Keep project context valid and synced with the store and current route.
  useEffect(() => {
    if (!Array.isArray(projects) || projects.length === 0) {
      setProjectName('');
      return;
    }

    if (params.projectId) {
      const routeProject = projects.find((p) => p._id === params.projectId);
      if (!routeProject) {
        setProjectName('');
        return;
      }

      setProjectName(routeProject.title || routeProject.name || '');
      if (
        storeProjectId !== routeProject._id ||
        typeof activeProject === 'string' ||
        !activeProject?.title
      ) {
        setActiveProject(routeProject);
      }
      return;
    }

    const current = projects.find((p) => p._id === storeProjectId) || projects[0];
    if (!current) {
      setProjectName('');
      return;
    }

    setProjectName(current.title || current.name || '');
    if (storeProjectId !== current._id || typeof activeProject === 'string' || !activeProject?.title) {
      setActiveProject(current);
    }
  }, [projects, params.projectId, storeProjectId, activeProject, setActiveProject]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigateForProjectContext = (projectId) => {
    const path = location.pathname;

    if (path.includes('/pm/projects/') && path.includes('/backlog')) {
      navigate(`/pm/projects/${projectId}/backlog`);
      return;
    }

    if (path.includes('/pm/projects/') && (path.includes('/board') || path.includes('/sprints/'))) {
      navigate(`/pm/projects/${projectId}/board`);
      return;
    }

    if (path === '/pm/backlog') {
      navigate(`/pm/projects/${projectId}/backlog`);
      return;
    }

    if (path === '/pm/board') {
      navigate(`/pm/projects/${projectId}/board`);
    }
  };

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard', path: '/pm/dashboard' },
    { name: 'My Projects', icon: 'folder_shared', path: '/pm/projects' },
    ...(activeProjectId ? [
      { name: 'Backlog', icon: 'assignment_late', path: `/pm/projects/${activeProjectId}/backlog` },
      { name: 'Sprint Board', icon: 'view_kanban', path: `/pm/projects/${activeProjectId}/board` },
    ] : [
      { name: 'Backlog', icon: 'assignment_late', path: '/pm/backlog' },
      { name: 'Sprint Board', icon: 'view_kanban', path: '/pm/board' },
    ]),
    { name: 'Analytics', icon: 'analytics', path: '/pm/analytics' },
    { name: 'My Team', icon: 'group', path: '/pm/team' },
    { name: 'Profile', icon: 'person', path: '/pm/profile' },
  ];

  const getInitials = (name) => {
    return name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'PM';
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-inter transition-colors duration-200">
      {/* SideNavBar */}
      <aside className="bg-white dark:bg-card-dark border-r border-slate-200 dark:border-border-dark docked left-0 h-screen w-[240px] fixed flex flex-col py-6 text-sm font-medium tracking-tight shadow-lg z-50">
        <div className="px-6 mb-8">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tighter">Project Manager</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Workspace</p>
        </div>
        
        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/10 text-primary active:scale-95'
                    : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`
              }
            >
              <span className="material-symbols-outlined" data-icon={item.icon}>
                {item.icon}
              </span>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 mt-auto">
          <div className="flex items-center justify-between px-3 py-3 text-slate-700 dark:text-white border-t border-slate-200 dark:border-border-dark mt-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="material-symbols-outlined text-2xl text-slate-400" data-icon="account_circle">
                account_circle
              </span>
              <span className="truncate font-semibold">{user?.name || 'Project Manager'}</span>
            </div>
            <button 
              onClick={handleLogout} 
              className="text-slate-400 hover:text-red-500 transition-colors ml-2 p-1 rounded-md" 
              title="Logout"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 ml-[240px] flex flex-col min-h-screen bg-slate-50 dark:bg-background-dark pb-10">
        {/* TopNavBar */}
        <header className="bg-white/80 dark:bg-card-dark/80 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center px-10 h-16 w-full border-b border-slate-200 dark:border-border-dark">
          <div className="flex items-center gap-6 flex-1">
            <div className="hidden md:block">
              {projects.length > 0 ? (
                <select 
                  value={activeProjectId || ''}
                  onChange={(e) => {
                    const selected = projects.find(p => p._id === e.target.value);
                    if (selected) {
                      setActiveProject(selected);
                      setProjectName(selected.title);
                      navigateForProjectContext(selected._id);
                    }
                  }}
                  className="bg-transparent text-lg font-black text-slate-800 dark:text-white outline-none cursor-pointer hover:text-primary transition-colors pr-2"
                >
                  <option value="" disabled>Select Project Context</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id} className="text-sm font-medium text-slate-800 dark:text-white bg-white dark:bg-card-dark cursor-pointer">
                      {p.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-lg font-black text-slate-800 dark:text-white">
                  {projectName ? projectName : 'Active Dashboard'}
                </span>
              )}
            </div>
            <div className="relative w-64 group hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="w-full bg-slate-100 dark:bg-zinc-900 border border-transparent dark:border-border-dark rounded-xl py-1.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="relative text-slate-500 dark:text-slate-400 hover:text-primary transition-colors">
              <span className="material-symbols-outlined" data-icon="notifications">
                notifications
              </span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full outline outline-2 outline-white dark:outline-card-dark"></span>
            </button>
            <div className="flex items-center gap-3 border-l pl-6 border-slate-200 dark:border-border-dark">
              <span className="font-medium text-slate-700 dark:text-slate-300 text-sm hidden lg:block">
                {user?.name || 'Project Manager'}
              </span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {getInitials(user?.name)}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Rendered Here */}
        <Outlet />
      </main>
    </div>
  );
};