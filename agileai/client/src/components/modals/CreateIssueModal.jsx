import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { createTask, previewAssignmentWarnings } from '../../api/tasks.api';
import { getProjects } from '../../api/projects.api';
import { getSprints } from '../../api/sprints.api';
import useProjectStore from '../../store/projectStore';
import useAuthStore from '../../store/authStore';
import { useDeveloperWorkload } from '../../hooks/useDeveloperWorkload';

const CreateIssueModal = ({ isOpen, onClose, onTaskCreated = () => {}, projectId }) => {
  const { activeProject } = useProjectStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [assignmentPreview, setAssignmentPreview] = useState(null);
  const [assignmentPreviewLoading, setAssignmentPreviewLoading] = useState(false);

  const [formData, setFormData] = useState({
    projectId: projectId || '',
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    storyPoints: '0',
    assigneeIds: [],
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
    if (projectId) {
      setFormData(prev => ({ ...prev, projectId }));
      return;
    }
    if (activeProject && !formData.projectId) {
      setFormData(prev => ({ ...prev, projectId: activeProject._id }));
    }
  }, [activeProject, formData.projectId, projectId]);

  useEffect(() => {
    if (formData.projectId) {
      fetchSprints(formData.projectId);
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (!formData.projectId || formData.assigneeIds.length === 0) {
      setAssignmentPreview(null);
      setAssignmentPreviewLoading(false);
      return;
    }

    let cancelled = false;

    const loadAssignmentPreview = async () => {
      setAssignmentPreviewLoading(true);
      try {
        const storyPointsNum = Number(formData.storyPoints);
        const previewRes = await previewAssignmentWarnings({
          projectId: formData.projectId,
          sprintId: formData.sprintId || undefined,
          assigneeIds: formData.assigneeIds,
          storyPoints: Number.isFinite(storyPointsNum) && storyPointsNum > 0 ? storyPointsNum : 0,
        });

        if (!cancelled) {
          setAssignmentPreview(previewRes?.data || null);
        }
      } catch (_err) {
        if (!cancelled) {
          setAssignmentPreview(null);
        }
      } finally {
        if (!cancelled) {
          setAssignmentPreviewLoading(false);
        }
      }
    };

    loadAssignmentPreview();

    return () => {
      cancelled = true;
    };
  }, [formData.projectId, formData.sprintId, formData.assigneeIds, formData.storyPoints]);

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

  const handleAssigneeChange = (e) => {
    const selectedIds = Array.from(e.target.selectedOptions)
      .map((option) => option.value)
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, assigneeIds: selectedIds }));
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
      const storyPointsNum = Number(formData.storyPoints);
      const selectedAssigneeIds = Array.from(new Set((formData.assigneeIds || []).filter(Boolean)));

      if (selectedAssigneeIds.length > 0) {
        try {
          const previewRes = await previewAssignmentWarnings({
            projectId: formData.projectId,
            sprintId: formData.sprintId || undefined,
            assigneeIds: selectedAssigneeIds,
            storyPoints: Number.isFinite(storyPointsNum) && storyPointsNum > 0 ? storyPointsNum : 0,
          });

          const previewData = previewRes?.data || null;
          const warnings = (previewData?.assignees || []).flatMap((row) =>
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
              return;
            }
          }

          setAssignmentPreview(previewData);
        } catch (warningErr) {
          console.warn('Assignment warning preview failed:', warningErr);
        }
      }

      const payload = {
        project: formData.projectId,
        title: formData.title,
        description: formData.description || '',
        type: (formData.type || 'task').toLowerCase(),
        priority: (formData.priority || 'medium').toLowerCase(),
        storyPoints: Number.isFinite(storyPointsNum) && storyPointsNum > 0 ? storyPointsNum : undefined,
        assignee: selectedAssigneeIds[0] || undefined,
        assignees:
          selectedAssigneeIds.length > 0
            ? selectedAssigneeIds.map((id) => ({
                user: id,
                contributionPercent: Number((100 / selectedAssigneeIds.length).toFixed(2)),
              }))
            : undefined,
        sprint: formData.sprintId || undefined,
      };

      // Remove undefined keys (so we don't overwrite backend defaults)
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const res = await createTask(payload);
      if (res.success) {
        if (typeof onTaskCreated === 'function') {
          onTaskCreated(res.data);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create issue');        
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find(p => p._id === formData.projectId) || activeProject;
  const assignmentWarnings = (assignmentPreview?.assignees || []).flatMap((row) =>
    (row?.warnings || []).map((warning, idx) => ({
      key: `${row?.user?._id || row?.userId || 'assignee'}-${idx}-${warning?.code || 'warning'}`,
      userName: row?.user?.name || 'Assignee',
      severity: warning?.severity,
      message: warning?.message,
    }))
  );
  const hasHighAssignmentWarning = assignmentWarnings.some((w) => w.severity === 'high');

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
                <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="task">Task</option>
                  <option value="story">Story</option>
                  <option value="bug">Bug</option>
                  <option value="epic">Epic</option>
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
                <select
                  name="assigneeIds"
                  multiple
                  value={formData.assigneeIds}
                  onChange={handleAssigneeChange}
                  className="w-full h-32 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
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
                <p className="mt-1 text-[11px] text-slate-500">Tip: hold Ctrl/Cmd to select multiple assignees.</p>
                {assignmentPreviewLoading && formData.assigneeIds.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">Checking assignment workload and burnout signals...</p>
                )}
                {assignmentWarnings.length > 0 && (
                  <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${hasHighAssignmentWarning ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <p className="font-semibold mb-1">{hasHighAssignmentWarning ? 'High-risk assignment advisory' : 'Assignment advisory'}</p>
                    <ul className="list-disc list-inside space-y-1">
                      {assignmentWarnings.slice(0, 3).map((warning) => (
                        <li key={warning.key}>{warning.userName}: {warning.message}</li>
                      ))}
                    </ul>
                    {assignmentWarnings.length > 3 && (
                      <p className="mt-1">+{assignmentWarnings.length - 3} more warning(s)</p>
                    )}
                    <p className="mt-1 font-medium">Advisory only. You can still create the issue.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
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
