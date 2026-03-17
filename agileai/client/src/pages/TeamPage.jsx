import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects.api';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { UserPlus, Mail, ShieldAlert } from 'lucide-react';

export const TeamPage = () => {
  const { projectId } = useParams();
  
  const { data: response, isLoading } = useQuery({
    queryKey: ['projectMembers', projectId],
    queryFn: () => projectsApi.getProjectMembers(projectId),
    enabled: !!projectId,
  });

  const members = response?.data || [];

  return (
    <PageShell title="Team Roster">
      
      {!projectId ? (
        <div className="flex flex-col items-center justify-center p-20 border rounded-lg bg-white border-slate-200">
           <h3 className="font-semibold text-slate-700">Select a project to view its team</h3>
           <p className="text-sm text-slate-500 mt-2">Team management operates at the project level.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-6">
            <Button>
              <UserPlus size={16} className="mr-2" /> Invite Member
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-4">Name</th>
                  <th scope="col" className="px-6 py-4">Role</th>
                  <th scope="col" className="px-6 py-4">Joined</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-slate-400">No members found.</td></tr>
                )}
                {members.map((member) => (
                  <tr key={member.user._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar fallback={member.user.name} size="sm" />
                        <div>
                          <p className="font-medium text-slate-900">{member.user.name}</p>
                          <p className="text-xs text-slate-500">{member.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={member.role === 'admin' ? 'primary' : 'default'} className="uppercase text-[10px]">
                        {member.role.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Button variant="ghost" size="icon" title="Email User"><Mail size={16} /></Button>
                       <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Remove"><ShieldAlert size={16} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageShell>
  );
};
