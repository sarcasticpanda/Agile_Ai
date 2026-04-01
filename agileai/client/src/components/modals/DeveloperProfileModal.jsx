import React, { useState, useEffect } from 'react';
import { X, Mail, Shield, ShieldCheck, Target, CheckCircle2, ChevronRight, Activity, Zap } from 'lucide-react';
import { addProjectMember, removeProjectMember } from '../../api/projects.api';
import useProjectStore from '../../store/projectStore';

const DeveloperProfileModal = ({ isOpen, onClose, developer }) => {
  const { activeProject } = useProjectStore();
  const [loading, setLoading] = useState(false);
  const [inProject, setInProject] = useState(false);

  useEffect(() => {
    if (!activeProject || !developer) return;
    const isMember = activeProject.members?.some(m => m.user._id === developer._id || m.user === developer._id);
    setInProject(isMember);
  }, [activeProject, developer]);

  if (!isOpen || !developer) return null;

  const handleToggleProjectMembership = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      if (inProject) {
        await removeProjectMember({ id: activeProject._id, uid: developer._id });
        setInProject(false);
      } else {
        await addProjectMember({ id: activeProject._id, data: { email: developer.email, role: 'developer' } });
        setInProject(true);
      }
    } catch (error) {
      console.error('Error toggling membership:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-2xl relative shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-border-dark">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Developer Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-6 mb-8">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-3xl shadow-lg">
              {getInitials(developer.name)}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{developer.name}</h3>
              <p className="text-slate-500 text-sm mb-3 flex items-center gap-2">
                <Mail size={14}/> {developer.email}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Shield size={12}/> {developer.role || 'Developer'}
                </span>
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-semibold tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12}/> {developer.status || 'Active'}
                </span>
              </div>
            </div>
            
            {activeProject && (
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">Active Project Config</span>
                <button 
                  onClick={handleToggleProjectMembership}
                  disabled={loading}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg ${
                    inProject 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' 
                      : 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'
                  }`}
                >
                  {loading ? 'Processing...' : inProject ? 'Remove from Project' : 'Add to Project'}
                </button>
                <div className="text-xs text-slate-400">Project: <span className="font-semibold text-slate-600 dark:text-slate-300">{activeProject.title}</span></div>
              </div>
            )}
          </div>

          {/* AI Metrics & Capacity */}
          <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-border-dark pb-2">
            Capacity & Performance
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Activity size={14}/> Capacity</div>
              <div className="text-xl font-black text-slate-800 dark:text-white">{developer.capacityHoursPerWeek || 40} <span className="text-sm font-medium text-slate-400">hrs/wk</span></div>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Zap size={14}/> Active Sprint Velocity</div>
              <div className="text-xl font-black text-slate-800 dark:text-white">- <span className="text-sm font-medium text-slate-400">pts</span></div>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Target size={14}/> Open Tasks</div>
              <div className="text-xl font-black text-slate-800 dark:text-white">0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeveloperProfileModal;
