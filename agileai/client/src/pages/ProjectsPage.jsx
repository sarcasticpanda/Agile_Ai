import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreVertical, LayoutGrid, List } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import * as projectsApi from '../api/projects.api';
import { formatDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';
import useUiStore from '../store/uiStore';
import { FullPageSpinner } from '../components/ui/Spinner';

export const ProjectsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setActiveProject } = useUiStore();

  const { data: response, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getProjects,
  });

  const projects = response?.data || [];

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.createProject,
    onSuccess: (res) => {
      queryClient.invalidateQueries(['projects']);
      setIsModalOpen(false);
      toast.success('Project created successfully');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to create project');
    }
  });

  const handleCreateProject = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    createProjectMutation.mutate(data);
  };

  const handleProjectClick = (projectId) => {
    setActiveProject(projectId);
    navigate(`/projects/${projectId}/backlog`); // Default to backlog for a project
  };

  if (isLoading) return <FullPageSpinner />;

  return (
    <PageShell title="Projects">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 rounded-md bg-white p-1 border border-slate-200">
          <button 
            className={`p-1.5 rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            className={`p-1.5 rounded-sm transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setViewMode('list')}
          >
            <List size={18} />
          </button>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus size={18} className="mr-2" /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-24 text-center">
          <div className="h-16 w-16 mb-4 rounded-full bg-slate-200 flex items-center justify-center">
            <LayoutGrid className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">No projects yet</h3>
          <p className="max-w-sm text-slate-500 mb-6 font-medium text-sm">Create your first project to start tracking work, planning sprints, and organizing your team.</p>
          <Button onClick={() => setIsModalOpen(true)}>Create a Project</Button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {projects.map((project) => (
             <div 
                key={project._id}
                onClick={() => handleProjectClick(project._id)}
                className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-indigo-300 cursor-pointer ${viewMode === 'list' ? 'flex items-center p-4' : 'flex flex-col'}`}
             >
                {/* Top Colored Bar using Project Color */}
                {viewMode === 'grid' && <div className="h-2 w-full" style={{ backgroundColor: project.color || '#4f46e5' }} />}
                
                <div className={`${viewMode === 'grid' ? 'p-6 flex-1' : 'flex-1 flex items-center justify-between'}`}>
                  <div className={viewMode === 'list' ? 'flex items-center gap-6' : ''}>
                    {/* List Mode Color Tag */}
                    {viewMode === 'list' && <div className="h-full w-1.5 rounded-full" style={{ backgroundColor: project.color || '#4f46e5' }} />}
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={project.status === 'active' ? 'primary' : 'default'} className="uppercase px-2 font-bold mb-1 tracking-wider text-[10px]">
                          {project.status}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                        {project.name}
                      </h3>
                      {viewMode === 'grid' && (
                        <p className="text-sm text-slate-500 line-clamp-2 h-10 overflow-hidden mb-4 font-medium">
                          {project.description || 'No description provided.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className={`flex items-center ${viewMode === 'grid' ? 'justify-between border-t border-slate-100 pt-4 mt-auto' : 'gap-8'}`}>
                    <div className="flex items-center text-xs font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-1">
                      Updated {formatDate(project.updatedAt)}
                    </div>
                    <div className="flex -space-x-2">
                      {project.members.slice(0, 3).map((member, i) => (
                         <div key={i} className="h-7 w-7 rounded-full bg-slate-300 ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shadow-sm" style={{ backgroundColor: `hsl(${Math.random() * 360}, 70%, 50%)` }}>
                            {member.user?.name ? member.user.name.charAt(0).toUpperCase() : '?'}
                         </div>
                      ))}
                      {project.members.length > 3 && (
                        <div className="h-7 w-7 rounded-full bg-slate-100 border text-slate-600 ring-2 ring-white flex items-center justify-center text-[10px] font-bold z-10 shadow-sm">
                          +{project.members.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
             </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Project"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input 
            name="name" 
            label="Project Name" 
            placeholder="e.g. Website Redesign" 
            required 
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea 
              name="description" 
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
              rows={3}
              placeholder="What is this project about?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select 
              name="status" 
              label="Initial Status" 
              defaultValue="planning" 
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'active', label: 'Active' },
              ]}
            />
            <Input 
              name="color" 
              type="color" 
              label="Theme Color" 
              defaultValue="#4f46e5" 
              className="h-[62px] cursor-pointer p-0 border-0" 
            />
          </div>
          
          <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createProjectMutation.isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

    </PageShell>
  );
};
