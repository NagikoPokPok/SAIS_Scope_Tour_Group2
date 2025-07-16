const { Server } = require('socket.io');

class WebSocketHandler {
  constructor() {
    this.io = null;
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:5500',
          'http://127.0.0.1:5500',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          "null" // Cho phép file:// protocol
        ],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`✅ Client connected: ${socket.id}`);

      socket.on('join:room', ({ teamId, subjectId }) => {
        const roomName = `team:${teamId}:subject:${subjectId}`;
        socket.join(roomName);
        console.log(`🏠 Socket ${socket.id} joined room: ${roomName}`);
        
        // Gửi thông báo xác nhận về client
        socket.emit('room:joined', { teamId, subjectId, roomName });
      });

      socket.on('leave:room', ({ teamId, subjectId }) => {
        const roomName = `team:${teamId}:subject:${subjectId}`;
        socket.leave(roomName);
        console.log(`🚪 Socket ${socket.id} left room: ${roomName}`);
      });

      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });
    });

    return this.io;
  }

  // Emit task created event to specific room
  emitTaskCreated(teamId, subjectId, task) {
    if (!this.io) {
      console.log('⚠️ WebSocket not initialized, skipping emit');
      return;
    }
    
    const roomName = `team:${teamId}:subject:${subjectId}`;
    const eventData = {
      task,
      teamId,
      subjectId,
      timestamp: new Date().toISOString()
    };
    
    console.log(`📡 Emitting TASK_CREATED to room: ${roomName}`, eventData);
    
    this.io.to(roomName).emit('task:created', eventData);
    
    // Log số clients trong room
    this.io.in(roomName).fetchSockets().then(sockets => {
      console.log(`📊 Room ${roomName} has ${sockets.length} connected clients`);
    });
  }

  // Emit task updated event
  emitTaskUpdated(teamId, subjectId, task) {
    if (!this.io) return;
    const roomName = `team:${teamId}:subject:${subjectId}`;
    this.io.to(roomName).emit(EVENTS.TASK_UPDATED, {
      task,
      teamId,
      subjectId,
      timestamp: new Date().toISOString()
    });
    console.log(`📢 Emitted TASK_UPDATED to room: ${roomName}`);
  }

  // Emit task deleted event
  emitTaskDeleted(teamId, subjectId, taskId) {
    if (!this.io) return;
    const roomName = `team:${teamId}:subject:${subjectId}`;
    this.io.to(roomName).emit(EVENTS.TASK_DELETED, {
      taskId,
      teamId,
      subjectId,
      timestamp: new Date().toISOString()
    });
    console.log(`📢 Emitted TASK_DELETED to room: ${roomName}`);
  }

  // Emit task submitted event
  emitTaskSubmitted(teamId, subjectId, taskId, userId) {
    if (!this.io) return;
    const roomName = `team:${teamId}:subject:${subjectId}`;
    this.io.to(roomName).emit(EVENTS.TASK_SUBMITTED, {
      taskId,
      userId,
      teamId,
      subjectId,
      timestamp: new Date().toISOString()
    });
    console.log(`📢 Emitted TASK_SUBMITTED to room: ${roomName}`);
  }
}

module.exports = new WebSocketHandler();