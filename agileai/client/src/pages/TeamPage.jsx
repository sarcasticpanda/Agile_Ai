import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, UserPlus, Search, Filter, Mail, CheckCircle2, 
  Shield, MoreVertical, ShieldAlert, Award, Briefcase,
  ExternalLink, Trash2, UserMinus
} from 'lucide-react';

import { PageShell } from '../components/layout/PageShell';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';

// API Imports
import * as teamApi from '../api/team.api';
import * as projectsApi from '../api/projects.api';

// Components
import DeveloperProfileModal from '../components/modals/DeveloperProfileModal';
import { AddMemberModal } from '../components/modals/AddMemberModal';

export const TeamPage = () => {
  const { projectId } = useParams();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState('my-team');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeveloper, setSelectedDeveloper] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isPM = user?.role?.toLowerCase() === 'pm';

  // --- DATA FETCHING ---

  // 1. Project Specific Members (if projectId exists)
  const { data: projectMembersRes, isLoading: isLoadingProject } = useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => projectsApi.getProjectMembers(projectId),
    enabled: !!projectId,
  });

  // 2. PM's Managed Team (if no projectId and is PM/Admin)
  const { data: rosterRes, isLoading: isLoadingRoster } = useQuery({
    queryKey: ['myRoster'],
    queryFn: teamApi.getMyRoster,
    enabled: !projectId && (isPM || isAdmin),
  });

  // 3. Global Talent Pool (if no projectId and is PM/Admin)
  const { data: poolRes, isLoading: isLoadingPool } = useQuery({
    queryKey: ['freePool'],
    queryFn: teamApi.getFreePool,
    enabled: !projectId && (isPM || isAdmin),
  });

  const projectMembers = projectMembersRes?.data || [];
  const myRoster = rosterRes?.data?.data || rosterRes?.data || [];
  const talentPool = poolRes?.data?.data || poolRes?.data || [];

  // --- MUTATIONS ---

  const claimMutation = useMutation({
    mutationFn: (id) => teamApi.claimDeveloper(id, {}),
    onSuccess: () => {
      toast.success('Developer claimed successfully!');
      queryClient.invalidateQueries({ queryKey: ['myRoster'] });
      queryClient.invalidateQueries({ queryKey: ['freePool'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to claim developer.');
    },
  });

  const releaseMutation = useMutation({
    mutationFn: ({ id, force }) => teamApi.forceReleaseDeveloper(id, force),
    onSuccess: () => {
      toast.success('Developer released to global pool.');
      queryClient.invalidateQueries({ queryKey: ['myRoster'] });
      queryClient.invalidateQueries({ queryKey: ['freePool'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to release developer.');
    },
  });

  const removeFromProjectMutation = useMutation({
    mutationFn: ({ projectId: targetProjectId, userId, force }) =>
      projectsApi.forceRemoveProjectMember({ id: targetProjectId, uid: userId, force }),
    onSuccess: () => {
      toast.success('Developer removed from project successfully.');
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      queryClient.invalidateQueries({ queryKey: ['myRoster'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to remove developer from project.');
    },
  });

  // --- HELPERS ---

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  };

  const filteredList = (list) => {
    if (!searchQuery) return list;
    return list.filter(item => {
        const name = item.name || item.user?.name || '';
        const role = item.role || item.user?.role || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               role.toLowerCase().includes(searchQuery.toLowerCase());
    });
  };

  const getImpactSummaryText = (impact = {}) => {
    const active = Number(impact.activeSprintAssignments || 0);
    const total = Number(impact.totalAssignments || 0);
    const backlog = Number(impact.backlogAssignments || 0);
    return `Assignments: ${total}\nActive sprint assignments: ${active}\nBacklog assignments: ${backlog}`;
  };

  const handleReleaseDeveloper = async (developer) => {
    try {
      const previewRes = await teamApi.previewReleaseDeveloperImpact(developer._id);
      const impact = previewRes?.data?.data || previewRes?.data || {};

      let force = false;
      if (Number(impact.activeSprintAssignments || 0) > 0) {
        const proceed = window.confirm(
          `This developer has active sprint assignments.\n\n${getImpactSummaryText(impact)}\n\nReleasing will remove them from your managed projects and unassign related tasks. Continue?`
        );
        if (!proceed) return;
        force = true;
      } else {
        const proceed = window.confirm(
          `Release ${developer.name} to the talent pool?\n\n${getImpactSummaryText(impact)}`
        );
        if (!proceed) return;
      }

      releaseMutation.mutate({ id: developer._id, force });
    } catch (error) {
      const impact = error?.response?.data?.data?.impact;
      if (error?.response?.status === 409 && impact) {
        const proceed = window.confirm(
          `Release warning:\n\n${getImpactSummaryText(impact)}\n\nProceed with force release?`
        );
        if (proceed) {
          releaseMutation.mutate({ id: developer._id, force: true });
        }
        return;
      }

      toast.error(error?.response?.data?.message || 'Failed to preview release impact.');
    }
  };

  const handleRemoveFromProject = async (member) => {
    const memberId = member?.user?._id;
    if (!projectId || !memberId) return;

    try {
      const previewRes = await projectsApi.previewProjectMemberRemoval({ id: projectId, uid: memberId });
      const impact = previewRes?.data || {};

      let force = false;
      if (Number(impact.activeSprintAssignments || 0) > 0) {
        const proceed = window.confirm(
          `This member has active sprint assignments in this project.\n\n${getImpactSummaryText(impact)}\n\nRemoving will also unassign them from project tasks. Continue?`
        );
        if (!proceed) return;
        force = true;
      } else {
        const proceed = window.confirm(
          `Remove ${member.user?.name || 'member'} from this project?\n\n${getImpactSummaryText(impact)}`
        );
        if (!proceed) return;
      }

      removeFromProjectMutation.mutate({ projectId, userId: memberId, force });
    } catch (error) {
      const impact = error?.response?.data?.data?.impact;
      if (error?.response?.status === 409 && impact) {
        const proceed = window.confirm(
          `Removal warning:\n\n${getImpactSummaryText(impact)}\n\nProceed with force removal?`
        );
        if (proceed) {
          removeFromProjectMutation.mutate({ projectId, userId: memberId, force: true });
        }
        return;
      }

      toast.error(error?.response?.data?.message || 'Failed to preview removal impact.');
    }
  };

  // --- RENDER LOGIC ---

  // Case A: Viewing members of a specific project
  if (projectId) {
    return (
      <PageShell title="Project Team">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">Project Members</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Personnel assigned to this specific project.</p>
          </div>
          {(isAdmin || isPM) && (
            <Button className="shadow-lg shadow-primary/20" onClick={() => setIsAddModalOpen(true)}>
              <UserPlus size={18} className="mr-2" /> Add Member
            </Button>
          )}
        </div>

        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-border-dark">
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Contributor</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Role</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Status</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {isLoadingProject ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">Explaining team structure...</td></tr>
              ) : filteredList(projectMembers).length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">No members assigned to this project.</td></tr>
              ) : filteredList(projectMembers).map((member) => (
                <tr key={member.user._id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors text-slate-800 dark:text-white">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar fallback={member.user.name} size="sm" className="bg-indigo-100 text-indigo-700" />
                      <div>
                        <p className="font-bold">{member.user.name}</p>
                        <p className="text-xs text-slate-500">{member.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <Badge variant={member.role === 'pm' ? 'primary' : 'default'} className="uppercase text-[10px]">
                      {member.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      Active
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right space-x-1">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary"><Mail size={16} /></Button>
                    {(isAdmin || isPM) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() => handleRemoveFromProject(member)}
                        disabled={removeFromProjectMutation.isPending}
                      >
                        <UserMinus size={16} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageShell>
    );
  }

  // Case B: General Team/Talent Pool View (PM/Admin Management)
  return (
    <PageShell title="Team & Talent">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Global Team Manager</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Allocate and manage developer resources across the organization.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="dark:bg-zinc-800">
            <Filter size={18} className="mr-2" /> Filters
          </Button>
          {(isAdmin || isPM) && (
            <Button className="shadow-lg shadow-primary/20" onClick={() => setIsAddModalOpen(true)}>
              <UserPlus size={18} className="mr-2" /> Invite Developer
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-border-dark mb-8">
        <button 
          onClick={() => setActiveTab('my-team')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'my-team' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          My Roster
          <span className="ml-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 py-0.5 px-2 rounded-full text-[10px]">{myRoster.length}</span>
          {activeTab === 'my-team' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.4)]"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('talent-pool')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'talent-pool' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          Talent Pool
          <span className="ml-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 py-0.5 px-2 rounded-full text-[10px]">{talentPool.length}</span>
          {activeTab === 'talent-pool' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.4)]"></div>}
        </button>
      </div>

      <div className="relative max-w-md mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search by name or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 dark:text-slate-200"
        />
      </div>

      {activeTab === 'my-team' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingRoster ? (
            <div className="col-span-full py-20 text-center text-slate-400">Loading your team...</div>
          ) : filteredList(myRoster).length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
               <Briefcase size={40} className="mx-auto mb-4 text-slate-300" />
               <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No developers assigned</h3>
               <p className="text-slate-500 mt-1 max-w-xs mx-auto">You haven't claimed any developers yet. Visit the Talent Pool to build your team.</p>
               <Button variant="outline" className="mt-4" onClick={() => setActiveTab('talent-pool')}>Browse Pool</Button>
            </div>
          ) : filteredList(myRoster).map(member => (
            <div 
              key={member._id} 
              className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl p-6 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative cursor-pointer"
              onClick={() => setSelectedDeveloper(member)}
            >
              <div 
                className="absolute top-4 right-4 text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 p-1" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setActiveMenuId(activeMenuId === member._id ? null : member._id);
                }}
              >
                <MoreVertical size={18} />
              </div>
              
              {activeMenuId === member._id && (
                <div 
                  className="absolute top-10 right-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl shadow-2xl z-50 py-2 w-48 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setSelectedDeveloper(member);
                      setActiveMenuId(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={14} /> View Details
                  </button>
                  <button 
                    onClick={() => { handleReleaseDeveloper(member); setActiveMenuId(null); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Release to Pool
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20">
                  {getInitials(member.name)}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white leading-none">{member.name}</h3>
                  <p className="text-slate-400 text-xs mt-2 font-bold uppercase tracking-widest">{member.role || 'Developer'}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-black text-slate-400 block mb-2">Assigned Projects</span>
                <div className="flex flex-wrap gap-2">
                  {member.projects && member.projects.length > 0 ? (
                    member.projects.map(p => (
                      <Badge key={p._id} variant="outline" className="text-[10px] bg-slate-50 dark:bg-zinc-900/50">
                        {p.title}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No assigned projects</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Status</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> Active
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-xl flex items-center justify-around text-center">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Projects</span>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{member.projectCount ?? 0}</div>
                  </div>
                  <div className="w-px h-6 bg-slate-200 dark:bg-zinc-700"></div>
                  <div>
                    <span className="text-[10px] uppercase font-black text-amber-500/80 block mb-1">Sprints</span>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{member.sprintCount ?? 0}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-border-dark">
                <th className="py-5 px-8 text-xs uppercase tracking-wider font-black text-slate-400">Developer</th>
                <th className="py-5 px-8 text-xs uppercase tracking-wider font-black text-slate-400">Role</th>
                <th className="py-5 px-8 text-xs uppercase tracking-wider font-black text-slate-400">Add to Project</th>
                <th className="py-5 px-8 text-xs uppercase tracking-wider font-black text-slate-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {isLoadingPool ? (
                <tr><td colSpan={4} className="p-20 text-center text-slate-400 font-medium">Scoring candidates...</td></tr>
              ) : filteredList(talentPool).length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center text-slate-400">No unassigned developers found in global pool.</td></tr>
              ) : filteredList(talentPool).map(talent => (
                <TalentPoolRow 
                  key={talent._id} 
                  talent={talent} 
                  onClaim={(id, projectId) => {
                    claimMutation.mutate(id, {
                      onSuccess: () => {
                        // If project selected, also add to that project
                        if (projectId) {
                          import('../api/projects.api').then(api => {
                            api.addProjectMember({ id: projectId, data: { email: talent.email, role: 'developer' }})
                              .then(() => {
                                toast.success(`Added to project and team!`);
                                queryClient.invalidateQueries(['projects']);
                              })
                              .catch(() => toast.error('Claimed but failed to add to project'));
                          });
                        }
                      }
                    });
                  }}
                  isLoading={claimMutation.isPending}
                  getInitials={getInitials}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDeveloper && (
        <DeveloperProfileModal 
          isOpen={!!selectedDeveloper} 
          onClose={() => setSelectedDeveloper(null)} 
          developer={selectedDeveloper} 
        />
      )}

      {isAddModalOpen && (
        <AddMemberModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          projectId={projectId} 
        />
      )}
    </PageShell>
  );
};

// Inline component: TalentPoolRow with project picker
const TalentPoolRow = ({ talent, onClaim, isLoading, getInitials }) => {
  const [selectedProjectId, setSelectedProjectId] = React.useState('');
  const { data: projectsRes } = useQuery({
    queryKey: ['projects'],
    queryFn: () => import('../api/projects.api').then(api => api.getProjects()),
    staleTime: 30000,
  });
  const projects = projectsRes?.data || [];

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-zinc-900/20 transition-all group text-slate-800 dark:text-white">
      <td className="py-5 px-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform">
            {getInitials(talent.name)}
          </div>
          <div>
            <div className="font-black group-hover:text-primary transition-colors">{talent.name}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
              <Mail size={12} /> {talent.email}
            </div>
          </div>
        </div>
      </td>
      <td className="py-5 px-8">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
           <Award size={16} className="text-amber-500" />
           <span className="text-sm capitalize">{talent.role || 'Developer'}</span>
        </div>
      </td>
      <td className="py-5 px-8">
        <select 
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
        >
          <option value="">Team only (no project)</option>
          {projects.map(p => (
            <option key={p._id} value={p._id}>{p.title}</option>
          ))}
        </select>
      </td>
      <td className="py-5 px-8 text-right">
        <Button 
          size="sm"
          onClick={() => onClaim(talent._id, selectedProjectId || null)}
          disabled={isLoading}
          className="font-black text-xs uppercase tracking-widest"
        >
          {isLoading ? 'Assigning...' : 'Claim & Assign'}
        </Button>
      </td>
    </tr>
  );
};
