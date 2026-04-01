import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Layers, 
  BarChart3, 
  Settings, 
  Users,
  Bolt,
  LogOut,
  ShieldCheck
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

export const Sidebar = () => {
  const { user, logout } = useAuthStore();
  
  // Fixed by @Frontend — role-based UI logic
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isPM = user?.role?.toLowerCase() === 'pm';
  const isDev = user?.role?.toLowerCase() === 'developer';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', show: true },
    { name: 'My Tasks', icon: CheckCircle2, path: '/my-tasks', show: true },
    { name: 'Projects', icon: Layers, path: '/projects', show: true },
    { name: 'Analytics', icon: BarChart3, path: '/analytics', show: !isDev },     
    { name: 'Team', icon: Users, path: '/team', show: !isDev },
    { name: 'Admin Panel', icon: ShieldCheck, path: '/admin', show: isAdmin },
  ];

  const filteredNavItems = navItems.filter(item => item.show);

  const handleLogout = () => {
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('agileai-project-storage');
    logout();
    window.location.href = '/login';
  };

  return (
    <aside className="w-16 flex flex-col items-center py-6 border-r border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark z-20 transition-colors duration-200">
      <div className="mb-10 text-primary">
        <Bolt size={32} className="fill-primary" />
      </div>
      
      <nav className="flex flex-col gap-6 flex-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `
              p-2 rounded-lg transition-all duration-200 group
              ${isActive 
                ? 'text-primary bg-primary/10' 
                : 'text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800'
              }
            `}
            title={item.name}
          >
            <item.icon size={22} />
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-6">
        <NavLink 
          to="/settings" 
          className={({ isActive }) => `
            p-2 rounded-lg transition-all duration-200
            ${isActive ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-primary'}
          `}
          title="Settings"
        >
          <Settings size={22} />
        </NavLink>
        
        <button
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-red-500 transition-colors"
          title="Logout"
        >
          <LogOut size={22} />
        </button>

        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
          {user?.name?.split(' ').map(n => n[0]).join('') || 'AU'}
        </div>
      </div>
    </aside>
  );
};

