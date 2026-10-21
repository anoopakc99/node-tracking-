const { Server } = require('socket.io');

let io = null;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:admin', () => {
      socket.join('admin-room');
    });

    socket.on('leave:admin', () => {
      socket.leave('admin-room');
    });

    socket.on('join:employee', (employeeId) => {
      if (employeeId) {
        socket.join(`employee-${employeeId}`);
      }
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
