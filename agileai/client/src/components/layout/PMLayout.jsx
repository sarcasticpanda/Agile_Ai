import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useProjectStore from '../../store/projectStore';

export const PMLayout = () => {
  const { user, logout } = useAuthStore();
  const { activeProject } = useProjectStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard', path: '/pm/dashboard' },
    { name: 'My Projects', icon: 'folder_shared', path: '/pm/projects' },
    { name: 'Backlog', icon: 'assignment_late', path: '/pm/backlog' },
    { name: 'Sprint Board', icon: 'view_kanban', path: '/pm/board' },
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
            <span className="text-lg font-black text-slate-800 dark:text-white hidden md:block">
              {activeProject ? `Project: ${activeProject.title || activeProject.name}` : 'Active Dashboard'}
            </span>
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