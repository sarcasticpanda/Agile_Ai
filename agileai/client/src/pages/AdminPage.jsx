import React, { useEffect } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../api/axiosInstance';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Shield, UserX, Activity } from 'lucide-react';
import { FullPageSpinner } from '../components/ui/Spinner';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export const AdminPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const { data: usersRes, isLoading } = useQuery({
    queryKey: ['adminTasks', 'users'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/users');
      return data;
    },
    enabled: user?.role === 'admin'
  });

  if (isLoading) return <FullPageSpinner />;

  const users = usersRes?.data || [];

  return (
    <PageShell title="System Administration">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
         {/* Simple quick stats */}
         <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
               <Shield size={24} />
            </div>
            <div>
               <p className="text-sm font-medium text-slate-500">Total Users</p>
               <h3 className="text-2xl font-bold text-slate-900">{users.length}</h3>
            </div>
         </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
           <h3 className="font-bold text-slate-800">User Management</h3>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-white border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Global Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-6 py-4">
                   <select 
                     className="bg-slate-50 border border-slate-200 text-xs rounded p-1 font-semibold uppercase text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                     defaultValue={u.role}
                   >
                     <option value="user">User</option>
                     <option value="project_manager">Project Mgr</option>
                     <option value="admin">Admin</option>
                   </select>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={u.isActive ? 'success' : 'danger'}>
                    {u.isActive ? 'Active' : 'Suspended'}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    {u.isActive ? 'Suspend' : 'Activate'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 h-7 text-xs px-2 hover:bg-red-50">
                    <UserX size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
};
