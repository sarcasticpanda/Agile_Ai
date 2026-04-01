import React, { useEffect, useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Shield, UserX, Activity, Users, Clock, Filter, UserCheck, HardDrive, History } from 'lucide-react';
import { FullPageSpinner } from '../components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { toast } from 'react-hot-toast';

export const AdminPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState({});
  const [activeTab, setActiveTab] = useState('all'); // all, pms, devs, pending, logs
  const [managerFilter, setManagerFilter] = useState(null); // ID of the manager to filter assigned devs

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ['adminTasks', 'users'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/users');
      return data;
    },
    enabled: user?.role === 'admin'
  });

  const { data: logsRes, isLoading: logsLoading } = useQuery({
    queryKey: ['adminTasks', 'logs'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/logs');
      return data;
    },
    enabled: user?.role === 'admin' && activeTab === 'logs'
  });

  if (usersLoading) return <FullPageSpinner />;

  const users = usersRes?.data || [];
  const logs = logsRes?.data || [];

  // Arrays to help with UI Assignment Dropdowns
  const pms = users.filter(u => u.role === 'pm' || u.role === 'admin');

  // Categorize Users for Tabs
  const pendingUsersList = users.filter(u => u.status === 'pending');
  const pmsList = users.filter(u => u.status !== 'pending' && ['pm', 'admin'].includes(u.role));
  const devsList = users.filter(u => u.status !== 'pending' && u.role === 'developer');
  const freeDevsList = devsList.filter(u => !u.managerId);

  // Base lists
  let assignedDevsList = devsList.filter(u => u.managerId);

  // Filter assigned devs if a manager is selected
  let displayedDevs = devsList;
  if (managerFilter) {
    displayedDevs = devsList.filter(u => u.managerId === managerFilter);
  }

  let displayedUsers = [];
  if (activeTab === 'all') displayedUsers = users;
  if (activeTab === 'pms') displayedUsers = pmsList;
  if (activeTab === 'devs') displayedUsers = displayedDevs;
  if (activeTab === 'pending') displayedUsers = pendingUsersList;

  // Render a specific PM's name for clarity
  const selectedManagerName = managerFilter ? users.find(u => u._id === managerFilter)?.name : null;

  const getTeamSize = (pmId) => {
    return devsList.filter(d => d.managerId === pmId).length;
  };

  // Handle role change
  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(prev => ({ ...prev, [userId + 'role']: true }));
    try {
      await axiosInstance.patch(`/admin/users/${userId}`, { role: newRole });   
      toast.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminTasks', 'users'] });     
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');      
    } finally {
      setActionLoading(prev => ({ ...prev, [userId + 'role']: false }));        
    }
  };

  // Handle status change
  const handleStatusChange = async (userId, newStatus) => {
    setActionLoading(prev => ({ ...prev, [userId + 'status']: true }));
    try {
      // If setting to active and it's a dev, they inherently go to free pool
      await axiosInstance.patch(`/admin/users/${userId}`, { status: newStatus });
      toast.success(`User status changed to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['adminTasks', 'users'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId + 'status']: false }));
    }
  };

  // Handle Manager Assignment
  const handleManagerChange = async (userId, newManagerId) => {
    setActionLoading(prev => ({ ...prev, [userId + 'manager']: true }));
    try {
      await axiosInstance.patch(`/admin/users/${userId}`, { managedBy: newManagerId || null });
      toast.success('Manager assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['adminTasks', 'users'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign manager');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId + 'manager']: false }));
    }
  };

  // Handle delete
  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete "${userName}"? This action cannot be undone.`)) return;
    setActionLoading(prev => ({ ...prev, [userId + 'delete']: true }));
    try {
      await axiosInstance.delete(`/admin/users/${userId}`);
      toast.success('User removed successfully');
      queryClient.invalidateQueries({ queryKey: ['adminTasks', 'users'] });     
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId + 'delete']: false }));      
    }
  };

  return (
    <PageShell title="System Administration">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Users</p>   
            <h3 className="text-2xl font-bold text-slate-900">{users.length}</h3>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Free Pool</p>
            <h3 className="text-2xl font-bold text-slate-900">{freeDevsList.length}</h3>
          </div>
        </div>
         <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending</p>
            <h3 className="text-2xl font-bold text-slate-900">{pendingUsersList.length}</h3>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Leaders (PM/Admin)</p>        
            <h3 className="text-2xl font-bold text-slate-900">{pmsList.length}</h3> 
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-8">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800">Resource Pools & Approvals</h3>
            <p className="text-xs text-slate-500">Manage organizational structure</p>
          </div>
          
          <div className="flex bg-slate-200 p-1 rounded-lg gap-1 flex-wrap">
            <button 
              onClick={() => { setActiveTab('all'); setManagerFilter(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              All Users
            </button>
            <button 
              onClick={() => { setActiveTab('pms'); setManagerFilter(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'pms' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Managers ({pmsList.length})
            </button>
            <button 
              onClick={() => { setActiveTab('devs'); setManagerFilter(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'devs' && !managerFilter ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              All Devs ({devsList.length})
            </button>
            {managerFilter && (
              <button 
                onClick={() => setActiveTab('devs')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'devs' && managerFilter ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
              >
                Team: {selectedManagerName} ({displayedDevs.length})
              </button>
            )}
            <button 
              onClick={() => { setActiveTab('pending'); setManagerFilter(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Pending ({pendingUsersList.length})
            </button>
            <button 
              onClick={() => { setActiveTab('logs'); setManagerFilter(null); }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800 flex items-center gap-1'}`}
            >
              <History size={14} /> Audit Logs
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          {activeTab === 'logs' ? (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-white border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Performed By</th>
                  <th className="px-6 py-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsLoading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading logs...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No logs found.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-3 font-mono text-xs text-indigo-600">{log.action}</td>
                      <td className="px-6 py-3">
                        {log.user ? (
                          <span><span className="font-medium text-slate-800">{log.user.name}</span> <span className="text-xs text-slate-400">({log.user.role})</span></span>
                        ) : 'System'}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-400">{log.ip || 'Unknown'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-white border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status Action</th>
                <th className="px-6 py-4">Role Action</th>
                <th className="px-6 py-4">Team Assignment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedUsers.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0">     
                        {u.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{u.name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>     
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <select
                      className={`${u.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'} border text-xs rounded p-1 font-semibold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50`}
                      value={u.status || 'pending'}
                      disabled={u._id === user?._id || actionLoading[u._id + 'status']}
                      onChange={(e) => handleStatusChange(u._id, e.target.value)} 
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      className="bg-slate-50 border border-slate-200 text-xs rounded p-1 font-semibold uppercase text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                      value={u.role}
                      disabled={u._id === user?._id || actionLoading[u._id + 'role']}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)} 
                    >
                      <option value="developer">Developer</option>
                      <option value="pm">Project Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                     {u.role === 'developer' && u.status !== 'pending' ? (
                      <div className="flex flex-col gap-1">
                        <select
                          className={`border text-xs rounded p-1 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 max-w-[180px] ${!u.managedBy ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                          value={u.managedBy || ''}
                          disabled={actionLoading[u._id + 'manager']}
                          onChange={(e) => handleManagerChange(u._id, e.target.value)} 
                        >
                          <option value="">● Free Pool (Unassigned)</option>
                          {pmsList.map(pm => (
                            <option key={pm._id} value={pm._id}>To: {pm.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : ['pm', 'admin'].includes(u.role) ? (
                         <div className="text-xs font-medium text-slate-600">
                           <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                             Team Size: {getTeamSize(u._id)}
                           </span>
                         </div>
                    ) : (
                       <span className="text-xs text-slate-400 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2 flex justify-end items-center mt-1">
                    {['pm', 'admin'].includes(u.role) && (
                      <Button
                        variant="soft"
                        size="sm"
                        className="h-7 text-xs px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 mr-2 border border-indigo-100"
                        onClick={() => {
                          setManagerFilter(u._id);
                          setActiveTab('devs');
                        }}
                      >
                        <Users size={14} className="mr-1" /> View Team
                      </Button>
                    )}
                     <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 h-7 text-xs px-2 hover:bg-red-50" 
                      disabled={u._id === user?._id || actionLoading[u._id + 'delete']}
                      onClick={() => handleDelete(u._id, u.name)}
                      title="Remove user"
                    >
                      {actionLoading[u._id + 'delete'] ? '...' : <UserX size={14} />}
                    </Button>
                  </td>
                </tr>
              ))}
              {displayedUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No users found in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </PageShell>
  );
};
