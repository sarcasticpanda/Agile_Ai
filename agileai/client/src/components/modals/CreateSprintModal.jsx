import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';        
import { createSprint } from '../../api/sprints.api';
import { getProjects } from '../../api/projects.api';
import useProjectStore from '../../store/projectStore';

const CreateSprintModal = ({ isOpen, onClose, onSprintCreated }) => {
  const { activeProject } = useProjectStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    goal: '',
    startDate: '',
    endDate: '',
    projectId: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeProject && !formData.projectId) {
      setFormData(prev => ({ ...prev, projectId: activeProject._id }));
    }
  }, [activeProject, formData.projectId]);

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      if (res.success) {
        setProjects(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectId) {
      setError('Please select a project.'); return;
    }
    setLoading(true); setError('');

    try {
      const payload = { ...formData };
      const res = await createSprint(payload);
      if (res.success) {
        onSprintCreated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create sprint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-lg relative shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-border-dark">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <CalendarIcon size={24} className="text-primary" />
            Create Sprint Container
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form id="create-sprint-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Project *</label>
              <select 
                name="projectId" 
                value={formData.projectId} 
                onChange={handleChange} 
                required
                className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>Select a Project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.title}</option>
                ))}
                {projects.length === 0 && activeProject && (
                  <option value={activeProject._id}>{activeProject.title}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Sprint Name *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Sprint 4" className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Sprint Goal</label>
              <textarea name="goal" value={formData.goal} onChange={handleChange} rows="2" placeholder="What do we want to achieve?" className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-border-dark flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-sprint-form" disabled={loading} className="px-6 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Sprint'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSprintModal;
