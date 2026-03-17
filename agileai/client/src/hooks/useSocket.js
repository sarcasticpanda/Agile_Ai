import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';

const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000';

export const useSocket = (projectId) => {
  const socketRef = useRef(null);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Connect
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      socket.emit('join:user', user._id);
      if (projectId) {
        socket.emit('join:project', projectId);
      }
    });

    // Listeners for invalidation
    socket.on('task:updated', () => {
      if (projectId) queryClient.invalidateQueries(['tasks', projectId]);
    });

    socket.on('sprint:updated', () => {
      if (projectId) queryClient.invalidateQueries(['sprints', projectId]);
    });

    socket.on('notification:new', () => {
      queryClient.invalidateQueries(['notifications']);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [user, projectId, queryClient]);

  return socketRef.current;
};
