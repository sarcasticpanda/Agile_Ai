import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import { FullPageSpinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { ChevronDown, ChevronRight, Activity, FolderKanban, Users, Shield, CheckCircle2, UserCheck, UserMinus, Plus, Clock } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';

const OrgNode = ({ pm }) => {
  const [expanded, setExpanded] = useState(false);
  const totalTasks = pm.projects.reduce((acc, p) => 
    acc + p.sprints.reduce((sAcc, s) => sAcc + s.tasks.length, 0)
  , 0);

  return (
    <div className="border border-slate-200 dark:border-border-dark rounded-xl mb-4 bg-white dark:bg-card-dark overflow-hidden shadow-sm hover:shadow transition-all">
      <div 
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xl shadow-inner">
            {pm.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight text-md flex items-center gap-2">
              {pm.name}
              <span className="text-[10px] text-slate-500 normal-case border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full font-semibold bg-slate-50 dark:bg-zinc-800">Project Manager</span>
              {pm.status === 'pending' && <span className="text-[10px] text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full font-bold">Pending</span>}
            </h3>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Users size={12} className="text-indigo-500"/> {pm.devs.length} Devs</p>
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1"><FolderKanban size={12} className="text-amber-500"/> {pm.projects.length} Projects</p>
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500"/> {totalTasks} Active Tasks</p>
            </div>
          </div>
        </div>
        <div className="text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-slate-100 dark:border-border-dark bg-slate-50/50 dark:bg-zinc-900/50 p-6 flex flex-col gap-6">
          
          {/* Active Projects Array */}
          <div className="space-y-6">
            <h4 className="text-[12px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
              <FolderKanban size={16}/> Project Portfolios
            </h4>
            
            {pm.projects.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active projects found.</p>
            ) : pm.projects.map(proj => {
              // Developers assigned to this project
              const projectDevs = proj.members.filter(m => m.user && m.role !== 'pm');
              
              return (
                <div key={proj._id} className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 bg-indigo-50/50 dark:bg-slate-800/80 border-b border-indigo-100 dark:border-slate-700 flex justify-between items-center">
                    <h5 className="font-bold text-slate-800 dark:text-white text-md flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: proj.color || '#6366f1'}}></div>
                      {proj.title}
                      <span className="text-[10px] font-mono font-normal text-slate-500 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded shadow-sm border border-slate-100 dark:border-zinc-600">{proj.key}</span>
                    </h5>
                    <div className="flex -space-x-2">
                      {projectDevs.map(m => (
                        <div key={m.user._id} title={m.user.name} className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[9px] border-2 border-white dark:border-card-dark z-10">
                          {m.user.name?.[0]?.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-5 flex flex-col lg:flex-row gap-6">
                    {/* View Sprints */}
                    <div className="flex-[2]">
                      <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sprints Pipeline</h6>
                      {proj.sprints.length === 0 ? <p className="text-xs text-slate-400 italic">No sprints created.</p> : (
                        <div className="space-y-4">
                          {proj.sprints.map(sprint => (
                            <div key={sprint._id} className="relative pl-6">
                              <div className="absolute left-1 top-2 bottom-0 w-px bg-indigo-100 dark:bg-slate-700"></div>
                              <div className="flex items-center gap-2 mb-2 relative">
                                <div className="absolute -left-[25px] top-1/2 -translate-y-1/2 w-3 h-px bg-indigo-200 dark:bg-slate-700"></div>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${sprint.status?.toLowerCase() === 'active' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                                  {sprint.status}
                                </span>
                                <h6 className="text-xs font-bold text-slate-700 dark:text-slate-300">{sprint.title}</h6>
                              </div>
                              <div className="space-y-1.5 pl-2 mt-2">
                                {sprint.tasks.length === 0 ? <p className="text-[10px] text-slate-400 italic">No tasks assigned.</p> : sprint.tasks.map(task => (
                                  <div key={task._id} className="flex justify-between items-center text-[11px] bg-slate-50 dark:bg-slate-800/80 p-2 rounded-md border border-slate-100 dark:border-slate-700 hover:border-indigo-200 transition-colors group">
                                    <div className="flex items-center gap-2 truncate">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-emerald-500' : task.status === 'in-progress' ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{task.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-2 py-0.5 rounded-full shadow-sm">
                                      <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[8px]">
                                        {task.assignee?.name?.[0]?.toUpperCase() || '?'}
                                      </div>
                                      {task.assignee?.name?.split(' ')[0] || 'Unassigned'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Idle / Bench Developers */}
          <div className="mt-4 pt-6 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-[12px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4">
              <Users size={16}/> Team Roster (Summary)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {pm.devs.length === 0 ? <span className="text-xs text-slate-400 italic">No developers assigned to this PM.</span> : pm.devs.map(dev => {
                const assignedProjects = pm.projects.filter(p => p.members.some(m => m.user?._id?.toString() === dev._id?.toString()));
                const isIdle = assignedProjects.length === 0;

                return (
                  <div key={dev._id} className={`flex items-center gap-2 p-2 rounded-lg border ${isIdle ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/50' : 'bg-white border-slate-200 dark:bg-card-dark dark:border-border-dark'} shadow-sm`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${isIdle ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {dev.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{dev.name.split(' ')[0]}</p>
                      <p className={`text-[9px] font-bold uppercase ${isIdle ? 'text-amber-600' : 'text-slate-400'}`}>
                        {isIdle ? 'Idle / Bench' : `${assignedProjects.length} Proj`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
};

export const AdminPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('tree');
  const [selectedPMs, setSelectedPMs] = useState({}); // track free pool selections

  // Queries
  const { data: hierarchyRes, isLoading: hierarchyLoading } = useQuery({
    queryKey: ['adminHierarchy'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/hierarchy');
      return data;
    },
    enabled: user?.role === 'admin'
  });

  const { data: pendingRes, isLoading: pendingLoading } = useQuery({
    queryKey: ['adminPending'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/pending-users');
      return data;
    },
    enabled: user?.role === 'admin'
  });

  const { data: poolRes, isLoading: poolLoading } = useQuery({
    queryKey: ['adminPool'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/free-pool');
      return data;
    },
    enabled: user?.role === 'admin'
  });

  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ['adminLogs'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/activity-logs');
      return data;
    },
    enabled: user?.role === 'admin',
    refetchInterval: 10000 
  });

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      await axiosInstance.patch(`/admin/users/${id}`, updates);
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPending'] });
      queryClient.invalidateQueries({ queryKey: ['adminPool'] });
      queryClient.invalidateQueries({ queryKey: ['adminHierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['adminLogs'] });
    },
    onError: (err) => {
      toast.error('Failed to update user');
      console.error(err);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      await axiosInstance.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      toast.success('User removed successfully');
      queryClient.invalidateQueries({ queryKey: ['adminPending'] });
      queryClient.invalidateQueries({ queryKey: ['adminHierarchy'] });
    }
  });

  if (hierarchyLoading || logsLoading || pendingLoading || poolLoading) return <FullPageSpinner />;

  const pmsList = hierarchyRes?.data || [];
  const logs = logsRes?.data || [];
  const pendingUsers = pendingRes?.data || [];
  const freeUsers = poolRes?.data || [];

  return (
    <PageShell title="Organizational Control Center">
      <div className="flex items-center gap-8 border-b border-slate-200 dark:border-border-dark mb-6">
        <button 
          onClick={() => setActiveTab('tree')}
          className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'tree' ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          Organization Tree
          {activeTab === 'tree' && <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.4)]"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'pending' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Clock size={16}/> Pending Approvals
          {pendingUsers.length > 0 && <span className="bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-[10px]">{pendingUsers.length}</span>}
          {activeTab === 'pending' && <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500 rounded-t-full shadow-[0_-2px_10px_rgba(245,158,11,0.4)]"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('pool')}
          className={`pb-4 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === 'pool' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Users size={16}/> Free Pool
          {freeUsers.length > 0 && <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-[10px]">{freeUsers.length}</span>}
          {activeTab === 'pool' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full shadow-[0_-2px_10px_rgba(16,185,129,0.4)]"></div>}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-10rem)]">
        
        {/* Left Panel: Content Area based on Tabs */}
        <div className="flex-[3] overflow-y-auto pr-2 rounded-xl custom-scrollbar pb-10">
          
          {activeTab === 'tree' && (
            <>
              <div className="mb-8 bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl p-6 text-white shadow-lg">
                <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight"><Shield className="text-indigo-400" size={28}/> Global Organization Tree</h2>
                <p className="text-sm text-indigo-200 mt-2 font-medium max-w-2xl leading-relaxed">X-Ray view of all Project Managers, their Developers, Projects, Sprints, and deeply active Tasks.</p>
              </div>
              <div className="space-y-4">
                {pmsList.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark italic">No Project Managers found.</div>
                ) : pmsList.map(pm => (
                  <OrgNode key={pm._id} pm={pm} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'pending' && (
            <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/30 dark:bg-amber-900/10">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock className="text-amber-500" size={20}/> New Registration Requests
                </h3>
                <p className="text-xs text-slate-500 mt-1">Review and approve accounts wanting to join the system.</p>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Requested Role</th>
                    <th className="p-4">Applied On</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingUsers.length === 0 ? (
                    <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No pending approvals.</td></tr>
                  ) : pendingUsers.map(user => (
                    <tr key={user._id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="p-4 flex items-center gap-3">
                        <Avatar fallback={user.name} size="sm" className="bg-amber-100 text-amber-700" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4 font-black uppercase text-xs tracking-widest text-slate-600 dark:text-slate-400">{user.role}</td>
                      <td className="p-4 text-xs font-mono text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => deleteUserMutation.mutate(user._id)}
                        >
                          Reject
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => updateUserMutation.mutate({ id: user._id, updates: { status: 'active' }})}
                        >
                          Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'pool' && (
            <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-900/10">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Users className="text-emerald-500" size={20}/> Unassigned Talent Pool
                </h3>
                <p className="text-xs text-slate-500 mt-1">Active developers not assigned to any Project Manager.</p>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-4">Developer</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Assign To PM</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {freeUsers.length === 0 ? (
                    <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No free developers in the pool.</td></tr>
                  ) : freeUsers.map(user => (
                    <tr key={user._id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="p-4 flex items-center gap-3">
                        <Avatar fallback={user.name} size="sm" className="bg-indigo-100 text-indigo-700" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="p-4 font-black uppercase text-xs tracking-widest text-slate-600 dark:text-slate-400">{user.role}</td>
                      <td className="p-4">
                        <select 
                          className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 text-sm p-2 rounded-lg outline-none"
                          value={selectedPMs[user._id] || ''}
                          onChange={(e) => setSelectedPMs({...selectedPMs, [user._id]: e.target.value})}
                        >
                          <option value="">Select Manager...</option>
                          {pmsList.map(pm => (
                            <option key={pm._id} value={pm._id}>{pm.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          size="sm" 
                          onClick={() => {
                            if (!selectedPMs[user._id]) return toast.error('Select a PM first');
                            updateUserMutation.mutate({ id: user._id, updates: { managedBy: selectedPMs[user._id] } });
                          }}
                        >
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Right Panel: Universal Date Log */}
        <div className="flex-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
          <div className="p-5 border-b border-slate-100 dark:border-border-dark bg-slate-50 dark:bg-slate-900/50 flex flex-col">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-md">
              <Activity size={18} className="text-emerald-500" /> Universal Timeline Log
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Auto-refreshing audit trail of system events</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center italic mt-10">No recent activity found.</p>
            ) : logs.map((log) => {
               const date = new Date(log.createdAt);
               const isToday = new Date().toDateString() === date.toDateString();
               const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
               const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
               
               return (
                <div key={log._id} className="relative pl-5 border-l-2 border-slate-100 dark:border-slate-800 pb-2">
                  <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-card-dark shadow-sm"></div>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {isToday ? 'Today' : dateString} • {timeString}
                    </span>
                    <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{log.resource}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-1">
                    <span className="font-bold text-slate-900 dark:text-white">{log.user?.name || 'System'}</span> performed <span className="font-semibold text-indigo-600 dark:text-indigo-400">{log.action?.replace(/_/g, ' ')}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </PageShell>
  );
};
