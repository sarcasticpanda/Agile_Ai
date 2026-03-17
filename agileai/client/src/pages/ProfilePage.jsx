import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import useAuthStore from '../store/authStore';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useForm } from 'react-hook-form';
import { toast } from '../components/ui/Toast';
import axiosInstance from '../api/axiosInstance';
import { useMutation } from '@tanstack/react-query';

export const ProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: user?.name,
      email: user?.email,
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await axiosInstance.patch('/auth/me', data);
      return res.data;
    },
    onSuccess: (data) => {
      if(data.success) {
         updateUser(data.data.user);
         toast.success('Profile updated');
      }
    }
  });

  const onSubmit = (data) => {
    updateMutation.mutate(data);
  };

  return (
    <PageShell title="My Profile">
      <div className="max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6 flex justify-between items-end">
             <Avatar 
               fallback={user?.name} 
               className="h-32 w-32 border-4 border-white text-4xl shadow-md"
             />
             <Badge className="mb-2 uppercase" variant={user?.role === 'admin' ? 'primary' : 'default'}>
               {user?.role.replace('_', ' ')}
             </Badge>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
             <div className="grid grid-cols-1 gap-6">
                <Input label="Full Name" {...register('name')} />
                <Input label="Email Address" type="email" disabled {...register('email')} />
             </div>
             <div className="pt-4 border-t border-slate-100 flex justify-end">
               <Button type="submit" isLoading={updateMutation.isPending}>Save Changes</Button>
             </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
};
