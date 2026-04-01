import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useProjectStore from '../../store/projectStore';
import { Layers, Bolt, Activity, Users, Plus } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import { getSprints } from '../../api/sprints.api';
import CreateSprintModal from '../../components/modals/CreateSprintModal';

export const PmDashboardPage = () => {
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState({
    projectCount: 0,
    activeSprintCount: 0,
    velocity: 0
  });
  
  const [currentSprint, setCurrentSprint] = useState(null);
  const [sprintProgress, setSprintProgress] = useState({ completed: 0, remaining: 0, percent: 0 });
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [activeProject]);

  const fetchDashboardData = async () => {
    try {
      // Get all projects for count
      const projRes = await axiosInstance.get('/projects');
      const projects = projRes.data?.data || [];
      
      let activeSprints = 0;
      
      if (activeProject) {
        const sprintRes = await getSprints(activeProject._id);
        const sprints = sprintRes.data || [];
        const active = sprints.find(s => s.status === 'active');
        
        if (active) {
          activeSprints = 1;
          setCurrentSprint(active);
          
          const tasks = active.tasks || [];
          const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'Done');
          const remainingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'Done');
          
          const compCount = completedTasks.length;
          const totalCount = tasks.length;
          const percent = totalCount === 0 ? 0 : Math.round((compCount / totalCount) * 100);
          
          setSprintProgress({
            completed: compCount,
            remaining: remainingTasks.length,
            percent
          });
        } else {
          setCurrentSprint(null);
        }
      }

      setMetrics({
        projectCount: projects.length,
        activeSprintCount: activeSprints,
        velocity: currentSprint?.velocity || 0 // Very simplified velocity for now
      });

    } catch (err) {
      console.error("Dashboard data fetch failed", err);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-inter">
      {/* Welcome Banner */}
      <section className="relative rounded-2xl overflow-hidden p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 shadow-xl border border-indigo-500/20">
        <div className="space-y-3 z-10">
          <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-indigo-50 text-xs font-bold tracking-wider uppercase border border-white/10">
            <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
            Project Manager Workspace
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Good morning, {user?.name?.split(' ')[0] || 'Leader'}</h2>
          
          {metrics.projectCount === 0 ? (
            <p className="text-indigo-100/90 max-w-lg text-base mt-2">Welcome to your Project Manager workspace! Create your first project to start tracking your team.</p>
          ) : (
            <p className="text-indigo-100/90 max-w-lg text-base mt-2">You are currently managing {metrics.projectCount} active projects. Use the tabs below to drive your sprints forward.</p>     
          )}
        </div>
        
        {metrics.projectCount > 0 ? (
          <button
            onClick={() => setIsCreateSprintModalOpen(true)}
            className="bg-white text-indigo-700 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 z-10 w-full md:w-auto justify-center"
          >
            <Plus size={20} />
            New Sprint
          </button>
        ) : (
          <button
            onClick={() => navigate('/pm/projects')}
            className="bg-white text-indigo-700 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 z-10 w-full md:w-auto justify-center"
          >
            <Plus size={20} />
            New Project
          </button>
        )}
        {/* Decorative element */}
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-0 right-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none"></div>
      </section>

      {/* Stats Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-border-dark flex flex-col justify-between hover:shadow-md transition-shadow">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">My Projects</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-4xl font-black text-slate-800 dark:text-white">{metrics.projectCount}</span>
            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <Layers className="text-indigo-600 dark:text-indigo-400" size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-border-dark flex flex-col justify-between hover:shadow-md transition-shadow">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Active Sprints</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-4xl font-black text-slate-800 dark:text-white">{metrics.activeSprintCount}</span>
            <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
              <Bolt className="text-purple-600 dark:text-purple-400" size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-border-dark flex flex-col justify-between hover:shadow-md transition-shadow">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Sprint Health</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-4xl font-black text-slate-800 dark:text-white">{sprintProgress.percent}%</span>
            <div className="w-10 h-10 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-[spin_3s_linear_infinite]"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-border-dark flex flex-col justify-between hover:shadow-md transition-shadow">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Team Velocity</span>
          <div className="flex items-end justify-between mt-4">
            <span className="text-4xl font-black text-slate-800 dark:text-white">{metrics.velocity}<span className="text-xl text-slate-400 ml-1">pts</span></span>
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Activity className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
          </div>
        </div>
      </section>

      {/* Current Sprint Section */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white px-1">Current Sprint</h3>
        {currentSprint ? (
          <div className="bg-white dark:bg-card-dark rounded-2xl p-8 border border-slate-200 dark:border-border-dark shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-50 dark:bg-zinc-800/30 -skew-x-12 translate-x-1/2 z-0 hidden md:block"></div>
            <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold tracking-widest text-[10px] uppercase">SPRINT • ACTIVE</p>
                </div>
                <h4 className="text-2xl font-black text-slate-800 dark:text-white">{currentSprint.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
                  Ends {new Date(currentSprint.endDate).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex-1 w-full max-w-xl">
                <div className="flex justify-between text-sm font-bold mb-2">
                  <span className="text-slate-600 dark:text-slate-300">Sprint Progress</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{sprintProgress.percent}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{width: `${sprintProgress.percent}%`}}></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{sprintProgress.completed} Tasks Completed</span>
                  <span>{sprintProgress.remaining} Tasks Remaining</span>
                </div>
              </div>
              
              <button onClick={() => navigate('/pm/board')} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors whitespace-nowrap w-full lg:w-auto shadow-sm">
                 View Kanban Board
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-card-dark rounded-2xl p-8 border border-white dark:border-border-dark flex flex-col items-center justify-center text-center">
            <Bolt className="text-slate-300 dark:text-slate-600 mb-3" size={32} />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No active sprints. Go to Backlog to start planning.</p>
            <button onClick={() => navigate('/pm/backlog')} className="mt-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors">
               Go to Backlog
            </button>
          </div>
        )}
      </section>

      {/* My Team Section Block */}
      <section className="space-y-4">
        <div className="flex justify-between items-end px-1">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">My Team Overview</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Status of your direct reports and available talent pool</p>
          </div>
          <button className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline hidden sm:block">
            Manage Team &rarr;
          </button>
        </div>
        <div className="bg-white dark:bg-card-dark p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-border-dark flex flex-col items-center justify-center min-h-[200px]">
           <Users size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
           <p className="text-slate-500 dark:text-slate-400 font-medium">Team layout component pending Phase 4.2...</p>
        </div>
      </section>

      {/* Create Sprint Modal */}
      <CreateSprintModal 
        isOpen={isCreateSprintModalOpen}
        onClose={() => setIsCreateSprintModalOpen(false)}
        onSprintCreated={fetchDashboardData}
      />
    </div>
  );
};