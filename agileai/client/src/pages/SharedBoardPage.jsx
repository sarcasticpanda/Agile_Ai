import React, { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTask } from '../hooks/useTask';
import { useSprint } from '../hooks/useSprint';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  defaultDropAnimationSideEffects 
} from '@dnd-kit/core';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import { TaskCard } from '../components/kanban/TaskCard';
import { FullPageSpinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { AlertCircle, Filter, SortAsc, User, ChevronDown, Plus } from 'lucide-react';
import { TaskDetailSlideOver } from './TaskDetailPage';
import { toast } from '../components/ui/Toast';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';
import axiosInstance from '../api/axiosInstance';
import * as tasksApi from '../api/tasks.api';
import { useDeveloperWorkload } from '../hooks/useDeveloperWorkload';

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'inprogress', title: 'In Progress' },
  { id: 'review', title: 'In Review' },
  { id: 'done', title: 'Done' }
];

export const SharedBoardPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { activeProject, setActiveProject } = useProjectStore();
  
  const projectId = params.projectId || activeProject?._id;
  const paramSprintId = params.sprintId;
  
  useEffect(() => {
    if (params.projectId && params.projectId !== activeProject?._id) {
      setActiveProject(params.projectId);
    }
  }, [params.projectId, activeProject, setActiveProject]);
  
  const { sprints, isLoading: isSprintsLoading, completeSprint } = useSprint(projectId);
  
  const targetSprintId = useMemo(() => {
    if (paramSprintId) return paramSprintId;
    if (!sprints?.length) return null;
    const active = sprints.find(s => s.status?.toLowerCase() === 'active');
    return active ? active._id : sprints[0]._id;
  }, [paramSprintId, sprints]);

  const { tasks, isLoading: isTasksLoading, updateTaskStatus, createTask } = useTask(projectId, targetSprintId);
  
  const [activeTask, setActiveTask] = React.useState(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);

  // Fetch project members for assignee picker
  useEffect(() => {
    if (projectId) {
      axiosInstance.get(`/projects/${projectId}/members`)
        .then(res => setProjectMembers(res.data?.data || []))
        .catch(() => {});
    }
  }, [projectId]);

  const { workloads, loading: workloadsLoading } = useDeveloperWorkload(projectId, targetSprintId);

  const activeSprint = useMemo(() => {
    return (sprints || []).find(s => s._id === targetSprintId);
  }, [sprints, targetSprintId]);

  // Helper for recommendation
  const projectDevs = projectMembers.filter(m => m.user && m.role !== 'pm');
  let recommendedDevId = null;
  if (projectDevs.length > 0 && targetSprintId && targetSprintId !== 'backlog') {
    let minLoad = Infinity;
    projectDevs.forEach(dev => {
      const devId = dev.user._id || dev.user;
      const load = workloads[devId] || 0;
      if (load < minLoad) {
        minLoad = load;
        recommendedDevId = devId;
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const tasksByStatus = useMemo(() => {
    const grouped = { todo: [], inprogress: [], review: [], done: [] };
    (tasks || []).forEach(task => {
      const key = task.status?.toLowerCase();
      if (grouped[key] !== undefined) {
        grouped[key].push(task);
      } else {
        grouped.todo.push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isPM = user?.role === 'pm';

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find(t => t._id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const activeTaskRecord = tasks.find(t => t._id === activeId);
    if (!activeTaskRecord) return;

    if (user.role === 'developer' && activeTaskRecord.assignee?._id?.toString() !== user._id?.toString()) {
      toast.error("You can only move tasks that are assigned to you.");
      return;
    }

    const overIsColumn = COLUMNS.some(c => c.id === overId);
    let targetContainer = null;

    if (overIsColumn) {
      targetContainer = overId;
    } else {
      const overTaskRecord = tasks.find(t => t._id === overId);
      if (overTaskRecord) {
        targetContainer = overTaskRecord.status;
      }
    }

    if (targetContainer && activeTaskRecord.status !== targetContainer) {
      updateTaskStatus({ id: activeId, status: targetContainer }).catch(err => {
         console.error(err);
         toast.error("Failed to move task");
      });
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const raw = Object.fromEntries(fd);
    const data = {
      title: raw.title,
      description: raw.description || '',
      type: (raw.type || 'task').toLowerCase(),
      priority: (raw.priority || 'medium').toLowerCase(),
      storyPoints: raw.storyPoints ? Number(raw.storyPoints) : 0,
      assignee: raw.assignee || undefined,
      project: projectId,
      sprint: targetSprintId || undefined,
    };
    try {
      await createTask(data);
      setShowCreateModal(false);
      toast.success('Task created!');
    } catch {
      toast.error('Failed to create task');
    }
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: { opacity: '0.4' },
      },
    }),
  };

  if (isTasksLoading || isSprintsLoading) return <FullPageSpinner />;

  if (!activeSprint) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 text-slate-500">
        <AlertCircle size={48} className="mb-4 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700 dark:text-white">No Sprint Active</h2>
        <p className="mt-2">Start a sprint from the backlog to view the board.</p>
        <Button className="mt-4" onClick={() => { const pfx = isPM ? '/pm' : ''; navigate(`${pfx}/projects/${projectId}/backlog`); }}>Go to Backlog</Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col p-6 overflow-hidden">        
        {/* Sub-Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark cursor-pointer overflow-hidden relative group">
              <select 
                value={activeSprint._id} 
                onChange={(e) => navigate(`${isPM ? '/pm' : ''}/projects/${projectId}/sprints/${e.target.value}`)}
                className="font-bold text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer appearance-none pr-6 z-10 w-full"
              >
                {sprints?.map(s => (
                  <option key={s._id} value={s._id}>{s.title}</option>
                ))}
              </select>
              <ChevronDown size={16} className="text-slate-400 absolute right-2 pointer-events-none group-hover:text-primary transition-colors" />
            </div>
            <div className="h-4 w-[1px] bg-slate-300"></div>
            <div className="text-xs text-slate-500 font-semibold tracking-wide">
              {new Date(activeSprint.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(activeSprint.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {(isAdmin || isPM) && (
              <>
                <Button 
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={14} className="mr-1" /> New Task
                </Button>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    completeSprint(activeSprint._id).then(() => {
                      const pfx = isPM ? '/pm' : '';
                      navigate(`${pfx}/projects/${projectId}/backlog`);
                    });
                  }}
                >
                  Complete Sprint
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide pb-1">
            <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <Filter size={12} />
              <span>Filter</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <SortAsc size={12} />
              <span>Sort</span>
            </button>
            <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
              <User size={12} />
              <span>Assignee</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">
              {tasks?.length || 0} tasks total
            </span>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto pb-8 mt-2">
          <div className="flex h-full gap-4 px-1" style={{ minWidth: `${COLUMNS.length * 290}px` }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {COLUMNS.map(column => (
                <KanbanColumn 
                  key={column.id} 
                  column={column} 
                  tasks={tasksByStatus[column.id] || []}
                  onTaskClick={(t) => setSelectedTaskId(t._id)}
                />
              ))}
              
              <DragOverlay dropAnimation={dropAnimation}>
                {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Task Detail Slide-Over */}
      <TaskDetailSlideOver 
        isOpen={!!selectedTaskId} 
        onClose={() => setSelectedTaskId(null)} 
        taskId={selectedTaskId} 
        projectId={projectId}
      />

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}></div>
          <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-lg relative shadow-2xl overflow-hidden z-10">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-border-dark">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Task in {activeSprint.title}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100">✕</button>
            </div>
            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input name="title" required placeholder="What needs to be done?" className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea name="description" rows={2} placeholder="Details..." className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                  <select name="type" defaultValue="Task" className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                    <option>Task</option>
                    <option>Story</option>
                    <option>Bug</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Priority</label>
                  <select name="priority" defaultValue="Medium" className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Points</label>
                  <input name="storyPoints" type="number" defaultValue="0" min="0" max="21" className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Assign To Capacity</label>
                <select name="assignee" className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">Unassigned</option>
                  {projectDevs.map(m => {
                    const dId = m.user._id;
                    const name = m.user.name;
                    const load = workloads[dId] || 0;
                    const isRecommended = dId === recommendedDevId;
                    
                    let label = name;
                    if (targetSprintId && targetSprintId !== 'backlog') {
                      label += ` • ${load} Tasks`;
                    }
                    if (isRecommended) {
                      label += ` ★ Rec`;
                    }
                    
                    return (
                      <option key={dId} value={dId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-border-dark">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
