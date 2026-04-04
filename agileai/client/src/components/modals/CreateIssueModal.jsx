import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { createTask } from '../../api/tasks.api';
import { getProjects } from '../../api/projects.api';
import { getSprints } from '../../api/sprints.api';
import useProjectStore from '../../store/projectStore';
import useAuthStore from '../../store/authStore';
import { useDeveloperWorkload } from '../../hooks/useDeveloperWorkload';

const CreateIssueModal = ({ isOpen, onClose, onTaskCreated }) => {
  const { activeProject } = useProjectStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    issueType: 'Task',
    priority: 'Medium',
    storyPoints: 0,
    assigneeId: '',
    sprintId: ''
  });

  const { workloads, loading: workloadsLoading } = useDeveloperWorkload(formData.projectId, formData.sprintId);

  // Helper to find the recommended developer index for the auto-recommend tag
  const projectDevs = (projects.find(p => p._id === formData.projectId) || activeProject)?.members?.filter(m => m.role !== 'pm') || [];
  
  let recommendedDevId = null;
  if (projectDevs.length > 0 && formData.sprintId && formData.sprintId !== 'backlog') {
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

  useEffect(() => {
    if (formData.projectId) {
      fetchSprints(formData.projectId);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      const res = await getProjects();
      if (res.success) setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSprints = async (pId) => {
    try {
      const res = await getSprints(pId);
      if (res.success) setSprints(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectId) {
      setError('Please select a project.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const payload = { ...formData };
      if (!payload.assigneeId) delete payload.assigneeId;
      if (!payload.sprintId) delete payload.sprintId; else payload.sprint = payload.sprintId; // map sprintId to sprint for task model

      const res = await createTask(payload);
      if (res.success) {
        onTaskCreated(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create issue');        
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find(p => p._id === formData.projectId) || activeProject;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-2xl relative shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-border-dark">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Create Issue</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form id="create-issue-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Issue Type</label>
                <select name="issueType" value={formData.issueType} onChange={handleChange} className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="Task">Task</option>
                  <option value="Story">Story</option>
                  <option value="Bug">Bug</option>
                  <option value="Epic">Epic</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Summary / Title *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="Short summary of the issue" className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows="3" placeholder="Provide details, acceptance criteria, etc." className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Sprint Assignment</label>
                <select 
                  name="sprintId" 
                  value={formData.sprintId} 
                  onChange={handleChange} 
                  className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Backlog (Unassigned)</option>
                  {sprints.map((s) => (
                    <option key={s._id} value={s._id}>{s.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignee Capacity</label>
                <select name="assigneeId" value={formData.assigneeId} onChange={handleChange} className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Unassigned</option>
                  {projectDevs.map(m => {
                    const dId = m.user?._id || m.user;
                    const name = m.user?.name || m.user;
                    const load = workloads[dId] || 0;
                    const isRecommended = dId === recommendedDevId;
                    
                    let label = name;
                    if (formData.sprintId && formData.sprintId !== 'backlog') {
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="Highest">Highest</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Lowest">Lowest</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Story Points</label>
                <input type="number" name="storyPoints" value={formData.storyPoints} onChange={handleChange} min="0" max="21" className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-border-dark flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-issue-form" disabled={loading} className="px-6 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Issue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateIssueModal;
