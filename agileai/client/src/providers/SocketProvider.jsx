import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import useAuthStore from '../store/authStore';
import useProjectStore from '../store/projectStore';
import {
  invalidateCachesForTaskPayload,
  invalidateCachesForSprintPayload,
} from '../hooks/useSocket';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '')
    : 'http://localhost:5001');

function projectIdFromLocation(pathname) {
  const m = pathname.match(/\/projects\/([a-f0-9]{24})/i);
  return m ? m[1] : null;
}

function projectIdFromStore(activeProject) {
  if (!activeProject) return null;
  return typeof activeProject === 'string' ? activeProject : activeProject._id || null;
}

/**
 * Single Socket.IO connection for the SPA: joins user room + best-effort project room
 * (from URL or active project store) so PM/dev/My Tasks all receive task/sprint updates.
 */
export const SocketProvider = ({ children }) => {
  const { user } = useAuthStore();
  const { activeProject } = useProjectStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  const routeProjectId = projectIdFromLocation(location.pathname);
  const storeProjectId = projectIdFromStore(activeProject);
  const projectId = routeProjectId || storeProjectId || null;

  useEffect(() => {
    if (!user?._id) return undefined;

    const socket = io(SOCKET_URL, {
      // Start with polling and upgrade to websocket when possible to avoid hard failures on dev restarts.
      transports: ['polling', 'websocket'],
      autoConnect: true,
    });
    const onConnect = () => {
      socket.emit('join:user', user._id);
      if (projectId) {
        socket.emit('join:project', projectId);
      }
    };

    const onTaskUpdated = (payload) => {
      invalidateCachesForTaskPayload(queryClient, payload);
    };

    const onTaskMoved = (payload) => {
      invalidateCachesForTaskPayload(queryClient, payload);
    };

    const onSprintUpdated = (payload) => {
      invalidateCachesForSprintPayload(queryClient, payload);
    };

    const onSprintStatus = (payload) => {
      invalidateCachesForSprintPayload(queryClient, payload);
    };

    socket.on('connect', onConnect);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:moved', onTaskMoved);
    socket.on('sprint:updated', onSprintUpdated);
    socket.on('sprint:status_changed', onSprintStatus);
    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:moved', onTaskMoved);
      socket.off('sprint:updated', onSprintUpdated);
      socket.off('sprint:status_changed', onSprintStatus);
      socket.disconnect();
    };
  }, [user?._id, projectId, queryClient]);

  return children;
};
