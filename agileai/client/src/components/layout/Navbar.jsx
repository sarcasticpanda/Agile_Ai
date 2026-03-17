import React from 'react';
import { Bell, Search, Plus } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export const Navbar = ({ title }) => {
  const { user } = useAuthStore();

  return (
    <header className="h-16 border-b border-border-light dark:border-border-dark bg-card-light/50 dark:bg-card-dark/50 backdrop-blur-md flex items-center justify-between px-8 z-10 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-500">Workspace /</span>
        <span className="text-sm font-semibold">{title || 'AgileAI Dashboard'}</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative flex items-center group">
          <Search size={18} className="absolute left-3 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search issues, projects..." 
            className="pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800/50 border-none rounded-full text-xs w-64 focus:ring-1 focus:ring-primary transition-all dark:text-white outline-none"
          />
          <span className="absolute right-3 text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 font-mono tracking-tight">⌘K</span>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md active:scale-95">
            <Plus size={14} /> New Issue
          </button>
          
          <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-card-dark"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

