import React, { useState } from 'react';
import useAuthStore from '../store/authStore';
import axiosInstance from '../api/axiosInstance';
import { toast } from 'react-hot-toast';

export const PendingPage = () => {
  const { user, logout, updateUser } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const response = await axiosInstance.get('/auth/me');
      const updatedUser = response.data.data;
      
      updateUser(updatedUser);
      
      if (updatedUser.status === 'active') {
        toast.success('Your account is now active!');
        // App.jsx will automatically handle the routing based on state change
      } else {
        toast.error('Account is still pending approval.');
      }
    } catch (error) {
      console.error('Failed to check status', error);
      toast.error('Could not check status right now.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md text-center">
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Account Pending
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Hi {user?.name || 'User'}, your account has been created successfully but is currently pending administrator approval.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            You cannot access the dashboard until an Admin activates your account and assigns you to a Project Manager.
          </p>
        </div>
        <div className="mt-8 flex flex-col space-y-3">
          <button
            onClick={checkStatus}
            disabled={isChecking}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Refresh Status'}
          </button>
          
          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};
