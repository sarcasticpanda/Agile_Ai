import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as teamApi from '../api/team.api';
import toast from 'react-hot-toast';
import { PageShell } from '../components/layout/PageShell';

export const PMTeamView = () => {
  const queryClient = useQueryClient();
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);

  // Fetch PM's Team Roster
  const { data: rosterResponse, isLoading: isLoadingRoster } = useQuery({
    queryKey: ['myRoster'],
    queryFn: teamApi.getMyRoster,
  });

  // Fetch Free Pool Developers
  const { data: poolResponse, isLoading: isLoadingPool } = useQuery({
    queryKey: ['freePool'],
    queryFn: teamApi.getFreePool,
  });

  const roster = rosterResponse?.data || [];
  const freePool = poolResponse?.data || [];

  const claimMutation = useMutation({
    mutationFn: (id) => teamApi.claimDeveloper(id),
    onSuccess: (data) => {
      toast.success('Developer claimed successfully!');
      queryClient.invalidateQueries({ queryKey: ['myRoster'] });
      queryClient.invalidateQueries({ queryKey: ['freePool'] });
      setIsPoolModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to claim developer.');
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (id) => teamApi.releaseDeveloper(id),
    onSuccess: () => {
      toast.success('Developer released to free pool!');
      queryClient.invalidateQueries({ queryKey: ['myRoster'] });
      queryClient.invalidateQueries({ queryKey: ['freePool'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to release developer.');
    },
  });

  const getInitials = (name) => {
    return name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  const colors = [
    'bg-primary-fixed-dim text-on-primary-fixed-variant',
    'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    'bg-secondary-container text-on-secondary-container',
  ];

  return (
    <PageShell title="My Team">
      <section className="px-6 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-on-surface">My Team</h2>
          <p className="text-on-surface-variant mt-1 text-md">Developers under your management</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPoolModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold text-sm shadow-lg shadow-primary/20 flex items-center gap-2 hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            + Add Developer
          </button>
        </div>
      </section>

      <section className="px-6 pb-20">
        {isLoadingRoster ? (
          <p>Loading roster...</p>
        ) : roster.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border shadow-sm">
            <h3 className="text-lg font-bold text-slate-700">No Developers Claimed</h3>
            <p className="text-slate-500 mt-2 mb-4">You have not claimed any developers yet. Build your team from the free pool.</p>
            <button 
              onClick={() => setIsPoolModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Browse Free Pool
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {roster.map((dev, idx) => (
              <div key={dev._id} className="bg-surface-container-lowest rounded-xl p-6 transition-all border border-transparent shadow-sm hover:shadow-xl hover:shadow-slate-200/50 group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${colors[idx % colors.length]}`}>
                      {getInitials(dev.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{dev.name}</h3>
                      <p className="text-xs text-slate-500">{dev.email}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${dev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {dev.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-100 text-center mb-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tasks</p>
                    <p className="text-sm font-bold text-slate-700">--</p>
                  </div>
                  <div className="border-x border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Current</p>
                    <p className="text-sm font-bold text-slate-700">--</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Velocity</p>
                    <p className="text-sm font-bold text-slate-700">--</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="flex-1 py-2 text-xs font-bold bg-surface-container-high text-primary rounded-lg hover:bg-primary-fixed transition-colors">
                    View Tasks
                  </button>
                  <button 
                    onClick={() => releaseMutation.mutate(dev._id)}
                    className="flex-1 py-2 text-xs font-bold bg-error-container text-error rounded-lg hover:bg-error hover:text-on-error transition-colors"
                  >
                    Release
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Free Pool Modal */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 relative shadow-2xl overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Claim Developer</h3>
                <p className="text-sm text-slate-500">Select a developer from the global free pool</p>
              </div>
              <button 
                onClick={() => setIsPoolModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {isLoadingPool ? (
                <p className="text-center py-4">Loading free pool...</p>
              ) : freePool.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 mb-2">No unassigned developers currently available.</p>
                </div>
              ) : (
                freePool.map(dev => (
                  <div key={dev._id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        {getInitials(dev.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{dev.name}</p>
                        <p className="text-xs text-slate-500">{dev.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => claimMutation.mutate(dev._id)}
                      disabled={claimMutation.isPending}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {claimMutation.isPending ? 'Claiming...' : 'Claim'}
                    </button>
                  </div>
                ))
              )}
            </div>
            
          </div>
        </div>
      )}
    </PageShell>
  );
};