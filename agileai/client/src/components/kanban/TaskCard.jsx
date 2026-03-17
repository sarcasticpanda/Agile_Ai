import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star } from 'lucide-react';

const getPriorityStyles = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'medium':
      return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'low':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  }
};

export const TaskCard = ({ task, onClick, isOverlay = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const priorityStyle = getPriorityStyles(task.priority);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`task-card group flex flex-col gap-3 rounded-xl border bg-white dark:bg-surface-dark p-4 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing
        ${isOverlay ? 'scale-[1.02] shadow-xl rotate-1 cursor-grabbing' : 'border-border-light dark:border-border-dark'}
      `}
    >
      <div className="flex justify-between items-start mb-1">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${priorityStyle}`}>
          {task.priority || 'Medium'}
        </span>
        <GripVertical size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <h4 className="text-sm font-semibold mb-1 leading-tight text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
        {task.title}
      </h4>

      {task.type === 'AI Task' && (
        <div className="mb-2">
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
            <div className="bg-primary w-[45%] h-full rounded-full"></div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-slate-400 font-medium">Progress</span>
            <span className="text-[10px] text-primary flex items-center font-bold">
              <Star size={10} className="mr-1 fill-primary" /> Active AI
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50 dark:border-slate-800/50">
        <div className="flex items-center space-x-3">
          <div className="relative">
             <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-surface-dark overflow-hidden">
                {task.assignee?.avatar ? <img src={task.assignee.avatar} alt="" /> : (task.assignee?.name?.charAt(0) || '?')}
             </div>
             <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white dark:border-surface-dark"></div>
          </div>
          <div className="flex items-center space-x-1 text-slate-400">
            <Star size={12} className={task.storyPoints > 5 ? 'fill-amber-400 text-amber-400' : ''} />
            <span className="text-[10px] font-bold text-slate-500">{task.storyPoints || 0}</span>
          </div>
        </div>
        <span className="text-[10px] font-bold text-slate-400 tracking-wider">
           #{task._id.substring(task._id.length - 4).toUpperCase()}
        </span>
      </div>
    </div>
  );
};

