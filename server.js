const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:8000", "https://fwh7gz-8000.csb.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store connected users and their rooms
const connectedUsers = new Map();
const userRooms = new Map();
const messages = new Map(); // Simple in-memory message storage

console.log('Starting Socket.io server...');

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication and joining
  socket.on('user:join', (userId) => {
    console.log(`User ${userId} joined with socket ${socket.id}`);
    connectedUsers.set(socket.id, userId);
    socket.userId = userId;
    
    // Join user to their personal room
    socket.join(`user_${userId}`);
    
    // Notify others that user is online
    socket.broadcast.emit('user:online', userId);
    
    // Send current online users to the newly connected user
    const onlineUsers = Array.from(connectedUsers.values());
    socket.emit('users:online', onlineUsers);
  });

  // Handle joining chat rooms
  socket.on('chat:join', (chatId) => {
    console.log(`User ${socket.userId} joining chat ${chatId}`);
    socket.join(chatId);
    
    // Store user's current room
    userRooms.set(socket.userId, chatId);
    
    // Send chat history if available
    const chatMessages = messages.get(chatId) || [];
    socket.emit('chat:history', chatMessages);
  });

  // Handle leaving chat rooms
  socket.on('chat:leave', (chatId) => {
    console.log(`User ${socket.userId} leaving chat ${chatId}`);
    socket.leave(chatId);
    userRooms.delete(socket.userId);
  });

  // Handle sending messages
  socket.on('message:send', (messageData) => {
    console.log('Message received:', messageData);
    
    // Create message with timestamp and ID
    const message = {
      ...messageData,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Store message
    const chatId = `chat_${[messageData.senderId, messageData.recipientId].sort().join('_')}`;
    if (!messages.has(chatId)) {
      messages.set(chatId, []);
    }
    messages.get(chatId).push(message);

    // Send to recipient
    socket.to(`user_${messageData.recipientId}`).emit('message:receive', message);
    
    // Send back to sender for confirmation
    socket.emit('message:receive', message);
    
    console.log(`Message sent from ${messageData.senderId} to ${messageData.recipientId}`);
  });

  // Handle typing indicators
  socket.on('message:typing', (data) => {
    console.log('Typing indicator:', data);
    socket.to(`user_${data.recipientId}`).emit('message:typing', {
      userId: data.userId,
      isTyping: data.isTyping
    });
  });

  // Handle getting chat history
  socket.on('chat:history', (chatId) => {
    const chatMessages = messages.get(chatId) || [];
    socket.emit('chat:history', chatMessages);
  });

  // Handle user going online
  socket.on('user:online', (userId) => {
    socket.broadcast.emit('user:online', userId);
  });

  // Handle user going offline
  socket.on('user:offline', (userId) => {
    socket.broadcast.emit('user:offline', userId);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log('User disconnected:', socket.id, 'Reason:', reason);
    
    const userId = connectedUsers.get(socket.id);
    if (userId) {
      connectedUsers.delete(socket.id);
      userRooms.delete(userId);
      
      // Notify others that user is offline
      socket.broadcast.emit('user:offline', userId);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Handle server errors
httpServer.on('error', (error) => {
  console.error('Server error:', error);
});

const PORT = process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
  console.log(`CORS enabled for: http://localhost:8000, https://fwh7gz-8000.csb.app`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Socket.io server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Socket.io server closed');
    process.exit(0);
  });
});
