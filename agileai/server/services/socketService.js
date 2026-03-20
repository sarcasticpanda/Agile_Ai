// Socket.io Service logic

export const initializeSockets = (io) => {
  io.on('connection', (socket) => {
    // console.log(`User connected: ${socket.id}`);

    // Join user's personal room to receive targeted notifications
    socket.on('join:user', (userId) => {
      socket.join(`user:${userId}`);
    });

    // Join project room to receive project level updates (task moved, sprint changed)
    socket.on('join:project', (projectId) => {
      socket.join(`project:${projectId}`);
    });

    // Join specific task room for comments
    socket.on('join:task', (taskId) => {
      socket.join(`task:${taskId}`);
    });

    socket.on('disconnect', () => {
      // console.log(`User disconnected: ${socket.id}`);
    });
  });
};
