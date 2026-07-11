const { Server } = require('socket.io');
const { supabaseAdmin } = require('./supabase');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        return next(new Error('Invalid or expired token'));
      }
      socket.userId = data.user.id;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Driver connected via WebSocket: ${socket.userId}`);
    socket.join(`driver:${socket.userId}`);

    socket.on('disconnect', (reason) => {
      console.log(`Driver disconnected: ${socket.userId} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket first.');
  }
  return io;
}

module.exports = { initSocket, getIO };
