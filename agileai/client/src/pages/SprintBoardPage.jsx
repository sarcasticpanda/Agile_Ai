import React, { useMemo } from 'react';
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
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn } from '../components/kanban/KanbanColumn';
import { TaskCard } from '../components/kanban/TaskCard';
import { FullPageSpinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { AlertCircle, Filter, SortAsc, User, ChevronDown, Plus } from 'lucide-react';
import { TaskDetailSlideOver } from './TaskDetailPage';
import { toast } from '../components/ui/Toast';

const COLUMNS = [
  { id: 'To Do', title: 'To Do' },
  { id: 'In Progress', title: 'In Progress' },
  { id: 'In Review', title: 'In Review' },
  { id: 'Done', title: 'Done' }
];

export const SprintBoardPage = () => {
  const { projectId, sprintId } = useParams();
  const navigate = useNavigate();
  
  const { tasks, isLoading: isTasksLoading, updateTaskStatus } = useTask(projectId, sprintId);
  const { sprints, isLoading: isSprintsLoading, completeSprint } = useSprint(projectId);
  
  const [activeTask, setActiveTask] = React.useState(null);
  const [selectedTaskId, setSelectedTaskId] = React.useState(null);

  const activeSprint = useMemo(() => {
    return (sprints || []).find(s => s._id === sprintId);
  }, [sprints, sprintId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const tasksByStatus = useMemo(() => {
    const grouped = { 'To Do': [], 'In Progress': [], 'In Review': [], 'Done': [] };
    (tasks || []).forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    return grouped;
  }, [tasks]);

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
      <PageShell title="Sprint Board">
        <div className="flex flex-col items-center justify-center p-20 text-slate-500">
          <AlertCircle size={48} className="mb-4 text-slate-300" />
          <h2 className="text-xl font-bold text-slate-700">Sprint Not Found</h2>
          <Button className="mt-4" onClick={() => navigate(`/projects/${projectId}/backlog`)}>Back to Backlog</Button>
        </div>
      </PageShell>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
      <PageShell title={activeSprint.name}>
        <div className="flex flex-col h-full -mt-4">
          
          {/* Sub-Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-border-light dark:hover:border-border-dark group">
                <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{activeSprint.name}</span>
                <ChevronDown size={16} className="text-slate-400" />
              </div>
              <div className="h-4 w-[1px] bg-border-light dark:bg-border-dark"></div>
              <div className="text-xs text-slate-500 font-semibold tracking-wide uppercase">
                {new Date(activeSprint.startDate).toLocaleDateString()} — {new Date(activeSprint.endDate).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex -space-x-2 mr-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-background-dark bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                    {i}
                  </div>
                ))}
                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-background-dark bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">+1</div>
              </div>
              <Button 
                variant="primary" 
                className="bg-primary hover:bg-primary/90 text-white font-bold text-xs"
                onClick={() => {
                  completeSprint(activeSprint._id).then(() => {
                    navigate(`/projects/${projectId}/backlog`);
                  });
                }}
              >
                Complete Sprint
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide pb-1">
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Filter size={12} />
                <span>Filter</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <SortAsc size={12} />
                <span>Sort</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
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
                    tasks={tasksByStatus[column.id]} 
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

