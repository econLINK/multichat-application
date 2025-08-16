'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  originalContent?: string;
  messageType: 'text' | 'voice' | 'file' | 'location' | 'event';
  timestamp: Date;
  isTranslated: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  event?: {
    title: string;
    date: Date;
    location?: string;
    description?: string;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  nativeLanguage: string;
  isOnline: boolean;
  lastSeen?: Date;
  avatar?: string;
  accountType: 'simple' | 'business';
}

export const useSocket = (userId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize socket connection
  useEffect(() => {
    if (!userId) return;

    const initSocket = () => {
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
        auth: {
          userId,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connection events
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Join user to their own room for notifications
        newSocket.emit('user:join', userId);
      });

      newSocket.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        
        // Auto-reconnect after delay for server disconnects
        if (reason === 'io server disconnect') {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (newSocket && !newSocket.connected) {
              newSocket.io.open();
            }
          }, 2000);
        }
      });

      newSocket.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Message events
      newSocket.on('message:receive', (message: Message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('message:typing', (data: { userId: string; isTyping: boolean }) => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.userId);
          } else {
            newSet.delete(data.userId);
          }
          return newSet;
        });
      });

      // User presence events
      newSocket.on('user:online', (userId: string) => {
        setOnlineUsers(prev => new Set([...prev, userId]));
      });

      newSocket.on('user:offline', (userId: string) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      });

      // Chat history
      newSocket.on('chat:history', (chatMessages: Message[]) => {
        setMessages(chatMessages);
      });

      return newSocket;
    };

    const socketInstance = initSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketInstance && socketInstance.connected) {
        socketInstance.disconnect();
      }
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId]);

  // Send message
  const sendMessage = (messageData: Omit<Message, 'id' | 'timestamp'>) => {
    if (socket && isConnected) {
      socket.emit('message:send', messageData);
    }
  };

  // Join chat room
  const joinChat = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit('chat:join', chatId);
    }
  };

  // Leave chat room
  const leaveChat = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit('chat:leave', chatId);
    }
  };

  // Send typing indicator
  const sendTyping = (recipientId: string, isTyping: boolean) => {
    if (socket && isConnected && userId) {
      socket.emit('message:typing', { userId, recipientId, isTyping });
    }
  };

  // Get chat history
  const getChatHistory = (chatId: string) => {
    if (socket && isConnected) {
      socket.emit('chat:history', chatId);
    }
  };

  // Mark user as online
  const setUserOnline = () => {
    if (socket && isConnected && userId) {
      socket.emit('user:online', userId);
    }
  };

  // Mark user as offline
  const setUserOffline = () => {
    if (socket && isConnected && userId) {
      socket.emit('user:offline', userId);
    }
  };

  return {
    socket,
    isConnected,
    onlineUsers: Array.from(onlineUsers),
    messages,
    typingUsers: Array.from(typingUsers),
    
    // Actions
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
    getChatHistory,
    setUserOnline,
    setUserOffline,
  };
};

// Hook for managing typing indicators with debouncing
export const useTypingIndicator = (
  socket: ReturnType<typeof useSocket>,
  recipientId: string,
  delay: number = 1000
) => {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      socket.sendTyping(recipientId, true);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to stop typing
    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.sendTyping(recipientId, false);
    }, delay);
  };

  const stopTyping = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      socket.sendTyping(recipientId, false);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isTyping,
    startTyping,
    stopTyping,
  };
};
