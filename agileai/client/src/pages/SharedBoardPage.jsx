import React, { useMemo, useEffect } from 'react';
import { PageShell } from '../components/layout/PageShell';
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
import { AlertCircle, Filter, SortAsc, User, ChevronDown } from 'lucide-react';
import { TaskDetailSlideOver } from './TaskDetailPage';
import { toast } from '../components/ui/Toast';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';

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
  
  // Also set the active project in store if accessed directly via URL
  useEffect(() => {
    if (params.projectId && params.projectId !== activeProject?._id) {
      setActiveProject(params.projectId);
    }
  }, [params.projectId, activeProject, setActiveProject]);
  
  const { sprints, isLoading: isSprintsLoading, completeSprint } = useSprint(projectId);
  
  // If sprintId isn't provided in the route, default to 'active' sprint or first one
  const targetSprintId = useMemo(() => {
    if (paramSprintId) return paramSprintId;
    if (!sprints?.length) return null;
    const active = sprints.find(s => s.status?.toLowerCase() === 'active');
    return active ? active._id : sprints[0]._id;
  }, [paramSprintId, sprints]);

  const { tasks, isLoading: isTasksLoading, updateTaskStatus } = useTask(projectId, targetSprintId);
  
  const [activeTask, setActiveTask] = React.useState(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState(null);

  const activeSprint = useMemo(() => {
    return (sprints || []).find(s => s._id === targetSprintId);
  }, [sprints, targetSprintId]);

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
        // Fallback to todo if empty or unknown
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

    // Role-based logic: Admins/PMs can drag anything. Developers can only drag tasks assigned to them?
    // Let's implement this check:
    if (user.role === 'developer' && activeTaskRecord.assigneeId?._id !== user._id) {
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
      <PageShell title="Project Board">
        <div className="flex flex-col items-center justify-center p-20 text-slate-500">
          <AlertCircle size={48} className="mb-4 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-700">No Sprint Active</h2>
          <p className="mt-2">Start a sprint from the backlog to view the board.</p>
          <Button className="mt-4" onClick={() => navigate(`/projects/${projectId}/backlog`)}>Go to Backlog</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      <PageShell title={`${activeSprint.title} Board`}>
        <div className="flex flex-col h-full -mt-4">
          
          {/* Sub-Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">
                <span className="font-bold text-slate-900">{activeSprint.title}</span>
                <ChevronDown size={16} className="text-slate-400" />
              </div>
              <div className="h-4 w-[1px] bg-slate-300"></div>
              <div className="text-xs text-slate-500 font-semibold tracking-wide uppercase">
                {new Date(activeSprint.startDate).toLocaleDateString()} — {new Date(activeSprint.endDate).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {(isAdmin || isPM) && (
                <Button 
                  variant="primary" 
                  onClick={() => {
                    completeSprint(activeSprint._id).then(() => {
                      navigate(`/projects/${projectId}/backlog`);
                    });
                  }}
                >
                  Complete Sprint
                </Button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide pb-1">
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-colors">
                <Filter size={12} />
                <span>Filter</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-colors">
                <SortAsc size={12} />
                <span>Sort</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-colors">
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
            <div className="flex h-full min-w-max space-x-6">
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
      </PageShell>

      <TaskDetailSlideOver 
        isOpen={!!selectedTaskId} 
        onClose={() => setSelectedTaskId(null)} 
        taskId={selectedTaskId} 
        projectId={projectId}
      />
    </div>
  );
};
