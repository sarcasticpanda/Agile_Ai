import React, { useState, useEffect } from 'react';
import { X, Mail, Shield, ShieldCheck, Target, CheckCircle2, ChevronRight, Activity, Zap } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addProjectMember,
  previewProjectMemberRemoval,
  forceRemoveProjectMember,
} from '../../api/projects.api';
import { toast } from 'react-hot-toast';

const DeveloperProfileModal = ({ isOpen, onClose, developer }) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  // Fetch PM's projects to populate dropdown
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: () => import('../../api/projects.api').then(api => api.getProjects()),
    enabled: isOpen,
  });
  const projects = projectsRes?.data || [];
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [inProject, setInProject] = useState(false);

  const toIdString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return String(value._id);
    if (typeof value.toString === 'function') return String(value.toString());
    return null;
  };

  useEffect(() => {
    if (!isOpen || !developer || projects.length === 0) return;

    const hasCurrentSelection = projects.some(
      (project) => toIdString(project?._id) === toIdString(selectedProjectId)
    );

    if (hasCurrentSelection) return;

    const firstMembership = projects.find((project) =>
      (project?.members || []).some((member) => {
        const memberUserId = toIdString(member?.user?._id || member?.user);
        return memberUserId === toIdString(developer?._id);
      })
    );

    setSelectedProjectId(toIdString(firstMembership?._id || projects[0]?._id) || '');
  }, [isOpen, developer, projects, selectedProjectId]);

  const currentAssignments = projects.filter((project) =>
    (project?.members || []).some((member) => {
      const memberUserId = toIdString(member?.user?._id || member?.user);
      return memberUserId === toIdString(developer?._id);
    })
  );

  useEffect(() => {
    if (!selectedProjectId || !developer) {
      setInProject(false);
      return;
    }

    const project = projects.find((p) => toIdString(p?._id) === toIdString(selectedProjectId));
    if (!project) return;
    
    const isMember = (project.members || []).some((m) => {
      const memberUserId = toIdString(m?.user?._id || m?.user);
      return memberUserId === toIdString(developer?._id);
    });

    setInProject(!!isMember);
  }, [selectedProjectId, projects, developer]);

  if (!isOpen || !developer) return null;

  const handleToggleProjectMembership = async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      if (inProject) {
        const previewRes = await previewProjectMemberRemoval({
          id: selectedProjectId,
          uid: developer._id,
        });

        const impact = previewRes?.data || {};
        const activeAssignments = Number(impact.activeSprintAssignments || 0);

        let force = false;
        if (activeAssignments > 0) {
          const proceed = window.confirm(
            `This developer has ${activeAssignments} active sprint assignment(s) in this project. Removing them will also unassign related tasks. Continue?`
          );
          if (!proceed) {
            setLoading(false);
            return;
          }
          force = true;
        }

        await forceRemoveProjectMember({ id: selectedProjectId, uid: developer._id, force });
        setInProject(false);
        toast.success('Removed from project successfully.');
      } else {
        await addProjectMember({ id: selectedProjectId, data: { email: developer.email, role: 'developer' } });
        setInProject(true);
        toast.success('Added to project successfully.');
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projectMembers'] });
      queryClient.invalidateQueries({ queryKey: ['myRoster'] });
    } catch (error) {
      console.error('Error toggling membership:', error);
      toast.error(error?.response?.data?.message || 'Failed to update project membership');
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
            
            {projects.length > 0 && (
              <div className="flex flex-col items-end gap-3 min-w-[200px]">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-widest">Assign to Project</span>
                
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.key ? `${p.key} - ${p.title}` : p.title}</option>
                  ))}
                </select>

                <button 
                  onClick={handleToggleProjectMembership}
                  disabled={loading || !selectedProjectId}
                  className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                    inProject 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' 
                      : 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'
                  } disabled:opacity-50`}
                >
                  {loading ? 'Processing...' : inProject ? 'Remove from Project' : 'Add to Project'}
                </button>
              </div>
            )}
          </div>

          {/* Current Project Assignments */}
          {currentAssignments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-border-dark pb-2">
                Current Project Assignments
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {currentAssignments.map(p => (
                  <div key={p._id} className="flex items-center justify-between bg-slate-50 dark:bg-zinc-900/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-border-dark">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{p.title}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                      p.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400'
                    }`}>{p.status || 'active'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
