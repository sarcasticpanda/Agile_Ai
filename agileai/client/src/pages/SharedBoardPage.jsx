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
import { AlertCircle, Filter, SortAsc, User, ChevronDown, Plus, Zap } from 'lucide-react';
import { TaskDetailSlideOver } from './TaskDetailPage';
import { toast } from '../components/ui/Toast';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';
import axiosInstance from '../api/axiosInstance';
import * as tasksApi from '../api/tasks.api';

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

  const activeProjectId = typeof activeProject === 'string' ? activeProject : activeProject?._id;
  const projectId = params.projectId || activeProjectId;
  const paramSprintId = params.sprintId;

  useEffect(() => {
    if (params.projectId && params.projectId !== activeProjectId) {
      setActiveProject(params.projectId);
    }
  }, [params.projectId, activeProjectId, setActiveProject]);
  
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

  const activeSprint = useMemo(() => {
    return (sprints || []).find(s => s._id === targetSprintId);
  }, [sprints, targetSprintId]);

  const sprintMemberIdSet = useMemo(() => {
    const ids = new Set();
    const members = activeSprint?.members || [];
    members.forEach((member) => {
      const id = member?._id || member;
      if (id) ids.add(String(id));
    });
    return ids;
  }, [activeSprint]);

  // Helper for recommendation
  const projectDevs = useMemo(() => {
    const fromProjectMembers = (projectMembers || [])
      .map((member) => {
        const userObj = member?.user && typeof member.user === 'object' ? member.user : null;
        const memberId = userObj?._id || member?.user || null;
        if (!memberId) return null;

        const memberRole = String(member?.role || userObj?.role || '').toLowerCase();
        if (memberRole === 'pm' || memberRole === 'admin') return null;

        if (sprintMemberIdSet.size > 0 && !sprintMemberIdSet.has(String(memberId))) {
          return null;
        }

        return {
          id: String(memberId),
          name: userObj?.name || member?.name || 'Unknown member',
          role: memberRole || 'developer',
        };
      })
      .filter(Boolean);

    if (fromProjectMembers.length > 0) {
      return fromProjectMembers;
    }

    // Fallback: use sprint members if project members payload is empty/malformed.
    return (activeSprint?.members || [])
      .map((member) => {
        const memberId = member?._id || member;
        if (!memberId) return null;

        const memberRole = String(member?.role || '').toLowerCase();
        if (memberRole === 'pm' || memberRole === 'admin') return null;

        return {
          id: String(memberId),
          name: member?.name || `User ${String(memberId).slice(-4)}`,
          role: memberRole || 'developer',
        };
      })
      .filter(Boolean);
  }, [projectMembers, sprintMemberIdSet, activeSprint]);

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
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isPM = user?.role?.toLowerCase() === 'pm';

  const toIdString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return String(value._id);
    if (typeof value.toString === 'function') return String(value.toString());
    return null;
  };

  const taskHasUserAssignment = (taskRecord, userId) => {
    if (!taskRecord || !userId) return false;
    const uid = String(userId);

    if (toIdString(taskRecord.assignee) === uid) return true;

    if (Array.isArray(taskRecord.assignees)) {
      const inAssignees = taskRecord.assignees.some((entry) => toIdString(entry?.user) === uid);
      if (inAssignees) return true;
    }

    if (Array.isArray(taskRecord.subtasks)) {
      const inSubtasks = taskRecord.subtasks.some((subtask) => toIdString(subtask?.assignee) === uid);
      if (inSubtasks) return true;
    }

    return false;
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const task = tasks.find(t => t._id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    if (String(activeSprint?.status || '').toLowerCase() === 'completed') {
      toast.error('Completed sprint is read-only. Move tasks from backlog planning instead.');
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    const activeTaskRecord = tasks.find(t => t._id === activeId);
    if (!activeTaskRecord) return;

    if (user?.role?.toLowerCase() === 'developer' && !taskHasUserAssignment(activeTaskRecord, user._id)) {
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
      if (user?.role?.toLowerCase() === 'developer') {
        if (targetContainer !== 'inprogress') {
          toast.error('Use Stop Timer & Log from My Tasks to move tasks to Review, Done, or Todo.');
          return;
        }

        const hasMyActiveTimer = (activeTaskRecord?.activeTimers || []).some(
          (timer) => toIdString(timer?.user) === String(user?._id)
        );

        if (!hasMyActiveTimer) {
          toast.error('Start your timer from My Tasks before moving task to In Progress.');
          return;
        }
      }

      updateTaskStatus({ id: activeId, status: targetContainer }).catch(err => {
         console.error(err);
         toast.error(err?.response?.data?.message || "Failed to move task");
      });
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const raw = Object.fromEntries(fd);
    const storyPoints = raw.storyPoints ? Number(raw.storyPoints) : 0;
    const assigneeIds = fd.getAll('assignees').filter(Boolean);
    const assignmentTarget = raw.assignmentTarget || 'sprint';
    const targetTaskSprintId = assignmentTarget === 'backlog' ? undefined : targetSprintId;

    if (assigneeIds.length > 0) {
      try {
        const previewRes = await tasksApi.previewAssignmentWarnings({
          projectId,
          sprintId: targetTaskSprintId || undefined,
          assigneeIds,
          storyPoints: Number.isFinite(storyPoints) && storyPoints > 0 ? storyPoints : 0,
        });

        const warnings = (previewRes?.data?.assignees || []).flatMap((row) =>
          (row?.warnings || []).map((warning) => ({
            severity: warning?.severity,
            message: warning?.message,
            userName: row?.user?.name || 'Assignee',
          }))
        );

        if (warnings.length > 0) {
          const hasHigh = warnings.some((w) => w.severity === 'high');
          const summary = warnings
            .slice(0, 4)
            .map((w) => `- ${w.userName}: ${w.message}`)
            .join('\n');

          const proceed = window.confirm(
            `${hasHigh ? 'High-risk assignment warning.' : 'Assignment warning.'}\n\n${summary}${warnings.length > 4 ? `\n...and ${warnings.length - 4} more warning(s).` : ''}\n\nProceed anyway?`
          );

          if (!proceed) {
            toast.error('Task creation cancelled. Review assignment advisories first.');
            return;
          }
        }
      } catch (warningError) {
        console.warn('Assignment warning preview failed:', warningError);
      }
    }

    const data = {
      title: raw.title,
      description: raw.description || '',
      type: (raw.type || 'task').toLowerCase(),
      priority: (raw.priority || 'medium').toLowerCase(),
      storyPoints: Number.isFinite(storyPoints) ? storyPoints : 0,
      assignee: assigneeIds[0] || undefined,
      assignees:
        assigneeIds.length > 0
          ? assigneeIds.map((id) => ({ user: id, contributionPercent: Number((100 / assigneeIds.length).toFixed(2)) }))
          : undefined,
      project: projectId,
      sprint: targetTaskSprintId || undefined,
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

  const riskScore = typeof activeSprint?.aiRiskScore === 'number' ? activeSprint.aiRiskScore : null;
  const riskLevel = (activeSprint?.aiRiskLevel || '').toLowerCase();
  const isCompletedSprintView = String(activeSprint?.status || '').toLowerCase() === 'completed';
  const riskBadgeClass =
    riskLevel === 'high'
      ? 'bg-red-50 text-red-700 border-red-200'
      : riskLevel === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : riskLevel === 'low'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';

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

            <div className="h-4 w-[1px] bg-slate-300"></div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${riskBadgeClass}`}>
              <Zap size={14} />
              <span>
                AI Risk: {riskScore == null ? 'Not computed' : `${Math.round(riskScore)}%`}
                {riskLevel ? ` (${riskLevel})` : ''}
              </span>
              {activeSprint?.aiLastAnalyzed && (
                <span className="text-[10px] font-semibold normal-case tracking-normal opacity-80">
                  • {new Date(activeSprint.aiLastAnalyzed).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {(isAdmin || isPM) && (
              <>
                <Button 
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs disabled:opacity-60"
                  onClick={() => {
                    if (isCompletedSprintView) {
                      toast.error('Completed sprint is read-only. Create new work in backlog or a planning sprint.');
                      return;
                    }
                    setShowCreateModal(true);
                  }}
                  disabled={isCompletedSprintView}
                >
                  <Plus size={14} className="mr-1" /> New Task
                </Button>
                <Button 
                  variant="primary" 
                  disabled={isCompletedSprintView}
                  onClick={() => {
                    completeSprint(activeSprint._id).then(() => {
                      const pfx = isPM ? '/pm' : '';
                      navigate(`${pfx}/projects/${projectId}/backlog`);
                    });
                  }}
                >
                  {isCompletedSprintView ? 'Sprint Completed' : 'Complete Sprint'}
                </Button>
              </>
            )}
          </div>
        </div>

        {isCompletedSprintView && (
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            This sprint is completed and read-only. Create or move work from backlog/planning sprint contexts.
          </div>
        )}

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
                  onAddTask={() => {
                    if (isCompletedSprintView) {
                      toast.error('Completed sprint is read-only.');
                      return;
                    }
                    setShowCreateModal(true);
                  }}
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
                  <input name="storyPoints" type="number" defaultValue="0" min="0" max="13" className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                Points measure complexity/size, priority measures urgency. Keep them independent for accurate velocity.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Place In</label>
                <select
                  name="assignmentTarget"
                  defaultValue="sprint"
                  className="w-full bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="sprint">Current Sprint ({activeSprint.title})</option>
                  <option value="backlog">Backlog</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Assign To Capacity</label>
                <select
                  name="assignees"
                  multiple
                  className="w-full h-28 bg-transparent border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  {projectDevs.length === 0 && (
                    <option value="" disabled>
                      No developer members available. Add devs in Project Team first.
                    </option>
                  )}

                  {projectDevs.map(dev => {
                    const dId = dev.id;
                    const name = dev.name;

                    return (
                      <option key={dId} value={dId}>
                        {name}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  {projectDevs.length === 0
                    ? 'No eligible developers found for this sprint. Add developers to the project/team and reopen this modal.'
                    : 'Tip: hold Ctrl/Cmd to select multiple assignees. Recommendations and warnings are generated from backend assignment advisories at submit time.'}
                </p>
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
