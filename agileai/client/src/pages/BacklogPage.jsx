import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageShell } from '../components/layout/PageShell';
import { useTask } from '../hooks/useTask';
import { TaskDetailSlideOver } from './TaskDetailPage';
import { useSprint } from '../hooks/useSprint';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { 
  Plus, 
  Filter, 
  SortAsc, 
  Search, 
  Zap, 
  ChevronDown, 
  Target,
  MoreVertical,
  ExternalLink,
  ArrowRightLeft,
  Calendar,
  Users
} from 'lucide-react';
import { getTaskPriorityColor } from '../utils/statusColors';
import { FullPageSpinner } from '../components/ui/Spinner';
import useAuthStore from '../store/authStore';
import axiosInstance from '../api/axiosInstance';
import * as tasksApi from '../api/tasks.api';
import { toast } from '../components/ui/Toast';

export const BacklogPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { tasks, isLoading: isTasksLoading, createTask } = useTask(projectId, null);
  const { sprints, isLoading: isSprintsLoading, createSprint, startSprint } = useSprint(projectId);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState('backlog');
  const [selectedTask, setSelectedTask] = useState(null);
  const [moveMenuTaskId, setMoveMenuTaskId] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isPM = user?.role === 'pm';

  // Fetch project members for assignee picker
  useEffect(() => {
    if (projectId) {
      axiosInstance.get(`/projects/${projectId}/members`)
        .then(res => {
          const members = res.data?.data || [];
          setProjectMembers(members);
        })
        .catch(() => {});
    }
  }, [projectId]);

  const activeSprints = useMemo(() => (sprints || []).filter(s => s.status !== 'completed'), [sprints]);
  
  const filteredTasks = useMemo(() => {
    if (selectedSprintId === 'backlog') {
      return (tasks || []).filter(t => !t.sprint);
    }
    return (tasks || []).filter(t => (t.sprint?._id || t.sprint) === selectedSprintId);
  }, [tasks, selectedSprintId]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const raw = Object.fromEntries(formData);
    const data = {
      title: raw.title,
      description: raw.description || '',
      type: (raw.type || 'task').toLowerCase(),
      priority: (raw.priority || 'medium').toLowerCase(),
      storyPoints: raw.storyPoints ? Number(raw.storyPoints) : undefined,
      assignee: raw.assignee || undefined,
      project: projectId,
      sprint: selectedSprintId === 'backlog' ? undefined : selectedSprintId,
    };
    await createTask(data);
    setIsTaskModalOpen(false);
  };

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const raw = Object.fromEntries(formData);
    if (!raw.startDate || !raw.endDate) {
      return alert('Please enter both start and end dates (YYYY-MM-DD)');
    }
    const data = {
      title: raw.title,
      goal: raw.goal || '',
      startDate: new Date(raw.startDate).toISOString(),
      endDate: new Date(raw.endDate).toISOString(),
      projectId,
    };
    await createSprint(data);
    setIsSprintModalOpen(false);
  };

  const handleMoveToSprint = async (taskId, targetSprintId) => {
    try {
      await tasksApi.updateTaskSprint({ id: taskId, sprintId: targetSprintId === 'backlog' ? null : targetSprintId });
      toast.success('Task moved successfully');
      setMoveMenuTaskId(null);
      // Force refetch
      window.location.reload();
    } catch {
      toast.error('Failed to move task');
    }
  };

  const formatSprintDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isTasksLoading || isSprintsLoading) return <FullPageSpinner />;

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
      <PageShell title="Product Backlog">
        <div className="flex flex-col h-full -mt-4">
          
          {/* Sub-Header */}
          <div className="flex items-center justify-between mb-4 border-b border-border-light dark:border-border-dark pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold">B</div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Product Backlog</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                <Filter size={14} /> Filter
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                <SortAsc size={14} /> Sort
              </button>
              {(isAdmin || isPM) && (
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-xs" onClick={() => setIsTaskModalOpen(true)}>
                  <Plus size={14} className="mr-1" /> New Issue
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden gap-6">
            
            {/* Left Pane: Sprints & Epics */}
            <div className="w-72 flex-shrink-0 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              <section>
                <div className="flex items-center justify-between mb-4 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sprints & Planning</span>
                  {(isAdmin || isPM) && (
                    <Plus size={16} className="text-slate-400 cursor-pointer hover:text-primary transition-colors" onClick={() => setIsSprintModalOpen(true)} />
                  )}
                </div>
                
                <div className="space-y-2">
                  <div 
                    onClick={() => setSelectedSprintId('backlog')}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedSprintId === 'backlog' ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-bold uppercase ${selectedSprintId === 'backlog' ? 'text-primary' : 'text-slate-400'}`}>Backlog</span>
                      <span className="text-[10px] text-slate-400 font-bold">{(tasks || []).filter(t => !t.sprint).length}</span>
                    </div>
                    <h4 className={`text-xs font-bold ${selectedSprintId === 'backlog' ? 'text-slate-900 dark:text-white' : 'text-slate-600'}`}>Main Backlog</h4>
                  </div>

                  {activeSprints.map(sprint => {
                    const sprintTasks = (tasks || []).filter(t => (t.sprint?._id || t.sprint) === sprint._id);
                    const doneTasks = sprintTasks.filter(t => t.status === 'done');
                    const progress = sprintTasks.length > 0 ? Math.round((doneTasks.length / sprintTasks.length) * 100) : 0;

                    return (
                      <div 
                        key={sprint._id}
                        onClick={() => setSelectedSprintId(sprint._id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedSprintId === sprint._id ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[11px] font-bold uppercase ${sprint.status === 'active' ? 'text-emerald-600' : selectedSprintId === sprint._id ? 'text-primary' : 'text-slate-400'}`}>
                            {sprint.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{sprintTasks.length}</span>
                        </div>
                        <h4 className={`text-xs font-bold ${selectedSprintId === sprint._id ? 'text-slate-900 dark:text-white' : 'text-slate-600'}`}>{sprint.title}</h4>
                        
                        {/* Sprint Dates */}
                        {(sprint.startDate || sprint.endDate) && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                            <Calendar size={10} />
                            <span>{formatSprintDate(sprint.startDate)} – {formatSprintDate(sprint.endDate)}</span>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-[10px] text-slate-400">{progress}%</span>
                        </div>
                        {sprint.status?.toLowerCase() === 'active' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); const pfx = isPM ? '/pm' : ''; navigate(`${pfx}/projects/${projectId}/sprints/${sprint._id}`); }}
                            className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
                          >
                            <ExternalLink size={10} /> Sprint Board
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4 px-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Initiatives</span>
                  <Zap size={14} className="text-primary opacity-50" />
                </div>
                <div className="p-4 rounded-xl border border-dashed border-border-light dark:border-border-dark text-center">
                   <p className="text-[11px] text-slate-400 font-medium">Automatic grouping of issues into AI Epics is available in Phase 2.</p>
                </div>
              </section>
            </div>

            {/* Right Pane: Tasks List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col border border-border-light dark:border-border-dark rounded-2xl bg-white dark:bg-card-dark shadow-sm min-w-0">
              <div className="px-6 py-4 flex items-center justify-between border-b border-border-light dark:border-border-dark sticky top-0 bg-white/80 dark:bg-card-dark/80 backdrop-blur-sm z-10 transition-colors">
                 <div className="flex items-center gap-2">
                   <Target size={16} className="text-primary" />
                   <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    {selectedSprintId === 'backlog' ? 'Main Backlog' : (activeSprints.find(s => s._id === selectedSprintId)?.title || 'Sprint')}
                   </h2>
                   <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold">{filteredTasks.length} issues</span>
                 </div>
                 {selectedSprintId !== 'backlog' && activeSprints.find(s => s._id === selectedSprintId)?.status === 'planning' && (isAdmin || isPM) && (
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4" onClick={() => {
                      startSprint(selectedSprintId).then(() => {
                        const pfx = isPM ? '/pm' : '';
                        navigate(`${pfx}/projects/${projectId}/sprints/${selectedSprintId}`);
                      }).catch(() => {});
                    }}>
                      Start Sprint
                    </Button>
                 )}
              </div>

              <div className="flex-1">
                {/* List Header */}
                <div className="px-6 py-3 border-b border-border-light dark:border-border-dark flex items-center text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="w-8 text-center">#</div>
                  <div className="flex-1 px-3 min-w-0">Title</div>
                  <div className="w-24 px-2 text-center hidden sm:block">Priority</div>
                  <div className="w-28 px-2 text-center hidden md:block">Assignee</div>
                  <div className="w-16 px-2 text-center hidden sm:block">Points</div>
                  <div className="w-20 px-2 text-center hidden lg:block">Status</div>
                  {(isAdmin || isPM) && <div className="w-10"></div>}
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Search size={48} className="mb-4 opacity-10" />
                    <p className="text-sm font-bold">No issues found here</p>
                    <p className="text-xs">Create a new issue to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-light dark:divide-border-dark">
                    {filteredTasks.map((task, idx) => (
                      <div key={task._id} className="group px-6 py-3.5 flex items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer relative" onClick={() => setSelectedTask(task)}>
                        <div className="w-8 text-center text-[11px] font-bold text-slate-400 font-mono">
                          {idx + 1}
                        </div>
                        <div className="flex-1 px-3 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">{task.title}</h4>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">{task.type || 'task'}</span>
                            <span className="text-[9px] text-slate-400 font-mono">#{task._id.substring(task._id.length - 4).toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="w-24 px-2 hidden sm:flex justify-center overflow-hidden">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTaskPriorityColor(task.priority)}`}>
                             {task.priority || 'Medium'}
                           </span>
                        </div>
                        <div className="w-28 px-2 hidden md:flex justify-center items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-surface-dark overflow-hidden flex-shrink-0">
                            {task.assignee?.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-[10px] text-slate-500 truncate">{task.assignee?.name || 'Unassigned'}</span>
                        </div>
                        <div className="w-16 px-2 text-center hidden sm:block">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{task.storyPoints || 0}</span>
                        </div>
                        <div className="w-20 px-2 text-center hidden lg:block">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            task.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                            task.status === 'inprogress' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{task.status?.replace('inprogress', 'In Progress') || 'Todo'}</span>
                        </div>
                        {(isAdmin || isPM) && (
                          <div className="w-10 flex justify-end relative" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="text-slate-400 hover:text-primary transition-colors p-1 rounded hover:bg-slate-100"
                              onClick={(e) => { e.stopPropagation(); setMoveMenuTaskId(moveMenuTaskId === task._id ? null : task._id); }}
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                            
                            {/* Move to Sprint dropdown */}
                            {moveMenuTaskId === task._id && (
                              <div className="absolute top-8 right-0 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl shadow-2xl z-50 py-2 w-48 overflow-hidden">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Move to</div>
                                <button 
                                  className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                  onClick={() => handleMoveToSprint(task._id, 'backlog')}
                                  disabled={!task.sprint}
                                >
                                  📋 Main Backlog
                                </button>
                                {activeSprints.map(s => (
                                  <button 
                                    key={s._id}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                                    onClick={() => handleMoveToSprint(task._id, s._id)}
                                    disabled={(task.sprint?._id || task.sprint) === s._id}
                                  >
                                    🏃 {s.title}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageShell>

      {/* Task Detail Slide-Over */}
      <TaskDetailSlideOver
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        taskId={selectedTask?._id}
        projectId={projectId}
      />

      {/* Create Task Modal — with Assignee Picker */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Create Issue">
        <form onSubmit={handleCreateTask} className="space-y-4 p-2">
          <Input name="title" label="Issue Summary" placeholder="What needs to be done?" required />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea 
              name="description" 
              rows={3} 
              className="w-full bg-transparent border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
              placeholder="Describe the issue..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select name="type" label="Issue Type" defaultValue="Story" options={[
              { value: 'Story', label: 'Story' },
              { value: 'Bug', label: 'Bug' },
              { value: 'Task', label: 'Task' },
            ]} />
            <Select name="priority" label="Priority" defaultValue="Medium" options={[
              { value: 'Low', label: 'Low' },
              { value: 'Medium', label: 'Medium' },
              { value: 'High', label: 'High' },
              { value: 'Critical', label: 'Critical' },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="storyPoints" type="number" label="Story Points" defaultValue="0" />
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <Users size={14} className="inline mr-1" /> Assign To
              </label>
              <select 
                name="assignee" 
                className="w-full bg-transparent border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Unassigned</option>
                {projectMembers
                  .filter(m => m.user && m.role !== 'pm')
                  .map(m => (
                    <option key={m.user._id} value={m.user._id}>
                      {m.user.name} ({m.role})
                    </option>
                  ))
                }
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full mt-4">Create Issue</Button>
        </form>
      </Modal>

      {/* Create Sprint Modal */}
      <Modal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} title="Create Sprint">
        <form onSubmit={handleCreateSprint} className="space-y-4 p-2">
          <Input name="title" label="Sprint Name" placeholder="e.g. Sprint 1" required />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sprint Goal (optional)</label>
            <textarea 
              name="goal" 
              rows={2}
              className="w-full bg-transparent border border-border-light dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
              placeholder="What should this sprint achieve?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input name="startDate" type="text" label="Start Date (YYYY-MM-DD)" placeholder="2026-04-01" required />
            <Input name="endDate" type="text" label="End Date (YYYY-MM-DD)" placeholder="2026-04-14" required />
          </div>
          <Button type="submit" className="w-full mt-4">Create Sprint</Button>
        </form>
      </Modal>

      {/* Click outside handler for move menu */}
      {moveMenuTaskId && (
        <div className="fixed inset-0 z-40" onClick={() => setMoveMenuTaskId(null)} />
      )}
    </div>
  );
};
