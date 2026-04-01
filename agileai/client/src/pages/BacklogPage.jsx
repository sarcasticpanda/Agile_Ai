import React, { useState, useMemo } from 'react'; // Fixed by GSD: Task 5 — added selectedTask state for slide-over
import { useParams, useNavigate } from 'react-router-dom'; // Fixed by GSD: Task 3 — useNavigate to redirect to sprint board
import { PageShell } from '../components/layout/PageShell';
import { useTask } from '../hooks/useTask';
import { TaskDetailSlideOver } from './TaskDetailPage'; // Fixed by GSD: Task 5 — import slide-over panel
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
  ExternalLink
} from 'lucide-react';
import { getTaskPriorityColor } from '../utils/statusColors';
import { FullPageSpinner } from '../components/ui/Spinner';
import useAuthStore from '../store/authStore';

export const BacklogPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate(); // Fixed by GSD Task 3 — navigate to sprint board and after start
  const { tasks, isLoading: isTasksLoading, createTask } = useTask(projectId, null);
  const { sprints, isLoading: isSprintsLoading, createSprint, startSprint } = useSprint(projectId);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState('backlog');
  const [selectedTask, setSelectedTask] = useState(null); // Fixed by GSD: Task 5 — state for slide-over

  // Fixed by @Frontend — role-based UI
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isPM = user?.role === 'pm';

  const activeSprints = useMemo(() => (sprints || []).filter(s => s.status !== 'completed'), [sprints]);
  
  const filteredTasks = useMemo(() => {
    if (selectedSprintId === 'backlog') {
      return (tasks || []).filter(t => !t.sprintId);
    }
    return (tasks || []).filter(t => (t.sprintId?._id || t.sprintId) === selectedSprintId);
  }, [tasks, selectedSprintId]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const raw = Object.fromEntries(formData);
    const data = {
      ...raw,
      issueType: raw.type || 'Story',
      priority: raw.priority || 'Medium',
      projectId: projectId,
      sprintId: selectedSprintId === 'backlog' ? undefined : selectedSprintId,
    };
    await createTask(data);
    setIsTaskModalOpen(false);
  };

  const handleCreateSprint = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      ...Object.fromEntries(formData),
      projectId, // Fixed by GSD: Sprint 400 — controller reads req.body.projectId, not req.body.project
    };
    await createSprint(data);
    setIsSprintModalOpen(false);
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
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-xs" onClick={() => setIsTaskModalOpen(true)}>
                <Plus size={14} className="mr-1" /> New Issue
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden gap-8">
            
            {/* Left Pane: Sprints & Epics */}
            <div className="w-80 overflow-y-auto custom-scrollbar flex flex-col gap-6">
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
                      <span className="text-[10px] text-slate-400 font-bold">{(tasks || []).filter(t => !t.sprintId).length}</span>
                    </div>
                    <h4 className={`text-xs font-bold ${selectedSprintId === 'backlog' ? 'text-slate-900' : 'text-slate-600'}`}>Main Backlog</h4>
                  </div>

                  {activeSprints.map(sprint => (
                    <div 
                      key={sprint._id}
                      onClick={() => setSelectedSprintId(sprint._id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedSprintId === sprint._id ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[11px] font-bold uppercase ${selectedSprintId === sprint._id ? 'text-primary' : 'text-slate-400'}`}>{sprint.status}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{(tasks || []).filter(t => (t.sprintId?._id || t.sprintId) === sprint._id).length}</span>
                      </div>
                      <h4 className={`text-xs font-bold ${selectedSprintId === sprint._id ? 'text-slate-900' : 'text-slate-600'}`}>{sprint.title}</h4>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: '0%' }}></div>
                        </div>
                        <span className="text-[10px] text-slate-400">0%</span>
                      </div>
                      {/* Fixed by GSD Task 3: Sprint Board button — navigates to board route with both IDs */}
                      {sprint.status?.toLowerCase() === 'active' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/projects/${projectId}/sprints/${sprint._id}`); }}
                          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
                        >
                          <ExternalLink size={10} /> Sprint Board
                        </button>
                      )}
                    </div>
                  ))}
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
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col border border-border-light dark:border-border-dark rounded-2xl bg-white dark:bg-card-dark shadow-sm">
              <div className="px-6 py-4 flex items-center justify-between border-b border-border-light dark:border-border-dark sticky top-0 bg-white/80 dark:bg-card-dark/80 backdrop-blur-sm z-10 transition-colors">
                 <div className="flex items-center gap-2">
                   <Target size={16} className="text-primary" />
                   <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                    {selectedSprintId === 'backlog' ? 'Main Backlog' : (activeSprints.find(s => s._id === selectedSprintId)?.name || 'Sprint')}
                   </h2>
                 </div>
                 {selectedSprintId !== 'backlog' && activeSprints.find(s => s._id === selectedSprintId)?.status === 'planning' && (isAdmin || isPM) && (
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4" onClick={() => {
                      startSprint(selectedSprintId).then(() => {
                        navigate(`/projects/${projectId}/sprints/${selectedSprintId}`); // Fixed by GSD: Task 3 — navigate to sprint board after starting
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
                  <div className="flex-1 px-4">Title</div>
                  <div className="w-32 px-4 text-center">Priority</div>
                  <div className="w-32 px-4 flex justify-center items-center">Assignee</div>
                  <div className="w-20 px-4 text-center">Points</div>
                  <div className="w-10"></div>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Search size={48} className="mb-4 opacity-10" />
                    <p className="text-sm font-bold">No issues found here</p>
                    <p className="text-xs">Create a new issue to get started.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-light dark:divide-border-dark">
                    {filteredTasks.map((task, idx) => ( // Fixed by GSD: Task 5 — onClick opens slide-over
                      <div key={task._id} className="group px-6 py-4 flex items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setSelectedTask(task)}>
                        <div className="w-8 text-center text-[11px] font-bold text-slate-400 font-mono">
                          {idx + 1}
                        </div>
                        <div className="flex-1 px-4">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{task.title}</h4>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">{task.issueType}</span>
                            <span className="text-[9px] text-slate-400 font-mono">#{task._id.substring(task._id.length - 4).toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="w-32 px-4 flex justify-center overflow-hidden">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getTaskPriorityColor(task.priority)}`}>
                             {task.priority || 'Medium'}
                           </span>
                        </div>
                        <div className="w-32 px-4 flex justify-center items-center">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-surface-dark overflow-hidden">
                            {task.assigneeId?.avatar ? <img src={task.assigneeId.avatar} alt="" /> : (task.assigneeId?.name?.charAt(0) || 'U')}
                          </div>
                        </div>
                        <div className="w-20 px-4 text-center">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{task.storyPoints || 0}</span>
                        </div>
                        <div className="w-10 flex justify-end">
                           <button className="text-slate-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                             <MoreVertical size={16} />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageShell>

      {/* Task Detail Slide-Over — Fixed by GSD: Task 5 */}
      <TaskDetailSlideOver
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        taskId={selectedTask?._id}
        projectId={projectId}
      />

      {/* Modals */}
      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="Create Issue">
        <form onSubmit={handleCreateTask} className="space-y-4 p-2">
          <Input name="title" label="Issue Summary" placeholder="What needs to be done?" required />
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
          <Input name="storyPoints" type="number" label="Story Points" defaultValue="0" />
          <Button type="submit" className="w-full mt-4">Create Issue</Button>
        </form>
      </Modal>

      <Modal isOpen={isSprintModalOpen} onClose={() => setIsSprintModalOpen(false)} title="Create Sprint">
        <form onSubmit={handleCreateSprint} className="space-y-4 p-2">
          <Input name="title" label="Sprint Name" placeholder="e.g. Sprint 1" required />
          <div className="grid grid-cols-2 gap-4">
            <Input name="startDate" type="date" label="Start Date" required />
            <Input name="endDate" type="date" label="End Date" required />
          </div>
          <Button type="submit" className="w-full mt-4">Create Sprint</Button>
        </form>
      </Modal>
    </div>
  );
};
