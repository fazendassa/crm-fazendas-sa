
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseWebSocketOptions {
  userId?: string;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { userId, onMessage, onError, reconnectInterval = 5000 } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const connect = () => {
    if (!userId) {
      console.log('📡 Cannot connect WebSocket: No user ID');
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${encodeURIComponent(userId)}`;
    
    console.log('📡 Connecting to WebSocket:', wsUrl);
    
    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('📡 WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        
        // Send ping to keep connection alive
        const pingInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          } else {
            clearInterval(pingInterval);
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 WebSocket message received:', data);
          
          // Handle built-in message types
          if (data.type === 'wa:qr' || data.type === 'wa:status') {
            queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
          } else if (data.type === 'wa:message') {
            queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages'] });
          }
          
          // Call custom message handler
          if (onMessage) {
            onMessage(data);
          }
        } catch (error) {
          console.error('📡 Error parsing WebSocket message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('📡 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;
        
        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`📡 Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      socket.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
        if (onError) {
          onError(error);
        }
      };

    } catch (error) {
      console.error('📡 Failed to create WebSocket connection:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Intentional disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setReconnectAttempts(0);
  };

  const send = (data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId]);

  return {
    isConnected,
    reconnectAttempts,
    connect,
    disconnect,
    send
  };
}
