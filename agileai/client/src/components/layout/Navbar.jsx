import React, { useState } from 'react';
import { Bell, Search, Plus } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useProjectStore from '../../store/projectStore';
import CreateIssueModal from '../modals/CreateIssueModal';

export const Navbar = ({ title }) => {
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();
  const [showIssueModal, setShowIssueModal] = useState(false);

  return (
    <header className="h-16 border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex items-center justify-between px-8 z-10 transition-colors duration-200 shadow-sm">
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
          {activeProject && (user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'pm') && (
            <button
              onClick={() => setShowIssueModal(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md active:scale-95 flex-shrink-0"
            >
              <Plus size={14} /> New Issue
            </button>
          )}

          <button
            onClick={() => alert('No new notifications yet')}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
          >
            <Bell size={20} />
          </button>
        </div>
      </div>

      {showIssueModal && activeProject && (
        <CreateIssueModal 
          isOpen={showIssueModal} 
          onClose={() => setShowIssueModal(false)}
          projectId={activeProject._id}
        />
      )}
    </header>
  );
};

