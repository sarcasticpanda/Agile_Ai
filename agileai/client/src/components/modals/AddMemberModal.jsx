import React, { useState } from 'react';
import { Mail, Shield, UserPlus, X, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as projectsApi from '../../api/projects.api';
import { toast } from 'react-hot-toast';

export const AddMemberModal = ({ isOpen, onClose, projectId }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const queryClient = useQueryClient();

  const addMemberMutation = useMutation({
    mutationFn: (data) => projectsApi.addProjectMember(projectId, data),
    onSuccess: () => {
      toast.success('Member added successfully!');
      queryClient.invalidateQueries({ queryKey: ['projectMembers', projectId] });
      setEmail('');
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to add member. Ensure the user exists and you have permission.');
    }
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return toast.error('Email is required');
    addMemberMutation.mutate({ email, role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-border-dark animate-in zoom-in-95 duration-200">
        <div className="p-6 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <UserPlus size={20} />
             </div>
             <h2 className="text-xl font-black text-slate-800 dark:text-white">Add Member</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Mail size={12} /> Email Address
            </label>
            <input 
              type="email" 
              placeholder="developer@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-slate-800 dark:text-white"
              required
            />
            <p className="text-[10px] text-slate-400 font-medium">The user must already have an account in AgileAI.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Shield size={12} /> Access Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer"
            >
              <option value="developer">Developer (Read/Write)</option>
              <option value="pm">Project Manager (Full Control)</option>
              <option value="viewer">Viewer (Read Only)</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
             <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
             >
                Cancel
             </button>
             <button 
              type="submit" 
              disabled={addMemberMutation.isPending}
              className="flex-1 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white py-3 px-6 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
             >
                {addMemberMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm Add
                  </>
                )}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};
