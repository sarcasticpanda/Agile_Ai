import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { MoreHorizontal } from 'lucide-react';

const getColumnColor = (id) => {
  switch (id) {
    case 'todo': return 'bg-slate-400'; // Fixed by GSD Task 6: match enum id not display name
    case 'inprogress': return 'bg-primary';
    case 'review': return 'bg-amber-500';
    case 'done': return 'bg-green-500';
    default: return 'bg-slate-400';
  }
};

export const KanbanColumn = ({ column, tasks, onTaskClick }) => {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const columnColor = getColumnColor(column.id);

  return (
    <div className="w-80 flex flex-col space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${columnColor}`}></div>
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">{column.title}</h3>
          <span className="text-xs font-bold text-slate-400 ml-1">{tasks.length}</span>
        </div>
        <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-400">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div 
        ref={setNodeRef} 
        className="flex-1 flex flex-col gap-3 min-h-[500px] overflow-y-auto pr-1 scrollbar-hide pb-4 transition-colors p-1"
      >
        <SortableContext items={tasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task._id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className="flex-1 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl flex items-center justify-center text-slate-300 text-xs font-medium min-h-[100px]">
            Drop tasks here
          </div>
        )}
      </div>

      <button className="w-full py-2 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl flex items-center justify-center space-x-2 text-slate-400 hover:text-primary hover:border-primary/50 transition-all text-sm font-medium group">
        <span className="text-lg group-hover:scale-110 transition-transform">+</span>
        <span>Add task</span>
      </button>
    </div>
  );
};

