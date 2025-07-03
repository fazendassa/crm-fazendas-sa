import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { whatsAppManager } from './whatsapp-service';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket[]> = new Map();

  setup(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('📡 New WebSocket connection attempt');

      // Extract user ID from query parameters or headers
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');

      if (!userId) {
        console.log('❌ WebSocket connection rejected: No user ID');
        ws.close(4001, 'User ID required');
        return;
      }

      ws.userId = userId;
      ws.isAlive = true;

      // Add client to user's connection list
      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId)!.push(ws);

      console.log(`✅ WebSocket connected for user: ${userId}`);

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: 'WebSocket connected successfully'
      }));

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📡 WebSocket message received:', message);
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('📡 Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      // Handle pong responses
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log(`📡 WebSocket disconnected for user: ${userId}`);
        this.removeClient(userId, ws);
      });

      ws.on('error', (error) => {
        console.log('📡 WebSocket error for user:', userId, error);
        this.removeClient(userId, ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({ 
        type: 'connected', 
        message: 'WebSocket connected successfully',
        userId 
      }));
    });

    // Set up ping interval to keep connections alive
    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          console.log(`💀 Terminating inactive WebSocket for user: ${ws.userId}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    // Set up WhatsApp event listeners
    this.setupWhatsAppListeners();

    console.log('🚀 WebSocket server setup complete');
  }

  private setupWhatsAppListeners() {
    // Listen for QR code events
    whatsAppManager.on('qr', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'wa:qr',
        sessionId: data.sessionId,
        qrCode: data.qrCode,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for status change events
    whatsAppManager.on('status', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'wa:status',
        sessionId: data.sessionId,
        status: data.status,
        phoneNumber: data.phoneNumber,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for message events
    whatsAppManager.on('message', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'wa:message',
        sessionId: data.sessionId,
        message: data.message,
        direction: data.direction,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for acknowledgment events
    whatsAppManager.on('ack', (data) => {
      this.broadcastToUser(data.userId, {
        type: 'wa:ack',
        sessionId: data.sessionId,
        messageId: data.messageId,
        status: data.status,
        timestamp: new Date().toISOString()
      });
    });
  }

  private async handleMessage(ws: AuthenticatedWebSocket, message: any) {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;

      case 'wa:create_session':
        if (ws.userId && data.sessionName) {
          try {
            const result = await whatsAppManager.createSession(ws.userId, data.sessionName);
            ws.send(JSON.stringify({ 
              type: 'wa:session_created', 
              message: result,
              sessionName: data.sessionName 
            }));
          } catch (error) {
            console.error('❌ Error creating WhatsApp session:', error);
            ws.send(JSON.stringify({ 
              type: 'wa:error', 
              message: 'Failed to create session',
              error: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
        }
        break;

      case 'wa:send_message':
        if (ws.userId && data.to && data.text) {
          try {
            const result = await whatsAppManager.sendMessage(ws.userId, data.to, data.text);
            ws.send(JSON.stringify({ 
              type: 'wa:message_sent', 
              result 
            }));
          } catch (error) {
            console.error('❌ Error sending WhatsApp message:', error);
            ws.send(JSON.stringify({ 
              type: 'wa:error', 
              message: 'Failed to send message',
              error: error instanceof Error ? error.message : 'Unknown error'
            }));
          }
        }
        break;

      case 'wa:get_status':
        if (ws.userId) {
          try {
            const status = await whatsAppManager.getSessionStatus(ws.userId);
            ws.send(JSON.stringify({ 
              type: 'wa:status', 
              status 
            }));
          } catch (error) {
            console.error('❌ Error getting WhatsApp status:', error);
            ws.send(JSON.stringify({ 
              type: 'wa:error', 
              message: 'Failed to get status' 
            }));
          }
        }
        break;

      case 'wa:get_messages':
        if (ws.userId) {
          try {
            const messages = await whatsAppManager.getMessages(
              ws.userId, 
              data.chatId, 
              data.limit || 50
            );
            ws.send(JSON.stringify({ 
              type: 'wa:messages', 
              messages 
            }));
          } catch (error) {
            console.error('❌ Error getting WhatsApp messages:', error);
            ws.send(JSON.stringify({ 
              type: 'wa:error', 
              message: 'Failed to get messages' 
            }));
          }
        }
        break;

      case 'wa:close_session':
        if (ws.userId) {
          try {
            await whatsAppManager.closeSession(ws.userId);
            ws.send(JSON.stringify({ 
              type: 'wa:session_closed', 
              message: 'Session closed successfully' 
            }));
          } catch (error) {
            console.error('❌ Error closing WhatsApp session:', error);
            ws.send(JSON.stringify({ 
              type: 'wa:error', 
              message: 'Failed to close session' 
            }));
          }
        }
        break;

      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: `Unknown message type: ${type}` 
        }));
    }
  }

  private removeClient(userId: string, ws: AuthenticatedWebSocket) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const index = userClients.indexOf(ws);
      if (index > -1) {
        userClients.splice(index, 1);
      }
      if (userClients.length === 0) {
        this.clients.delete(userId);
      }
    }
  }

  public broadcastToUser(userId: string, message: any) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const messageStr = JSON.stringify(message);
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  public broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach(userClients => {
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    });
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  public getUserConnectionCount(userId: string): number {
    return this.clients.get(userId)?.length || 0;
  }
}

export const webSocketManager = new WebSocketManager();