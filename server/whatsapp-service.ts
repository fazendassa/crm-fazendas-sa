import { create, Whatsapp, SocketState } from '@wppconnect-team/wppconnect';
import { EventEmitter } from 'events';
import { storage } from './storage';
import { webSocketManager } from './websocket';

interface SessionOptions {
  session: string;
  headless: boolean;
  devtools: boolean;
  useChrome: boolean;
  debug: boolean;
  logQR: boolean;
  browserWS: string;
  executablePath: string;
  browserArgs: string[];
  catchQR: (base64Qr: string, asciiQR?: string) => void;
  statusFind: (statusSession: string, session?: any) => void;
  onLoadingScreen?: (percent: number, message: string) => void;
  onIncomingCall?: (callInfo: any) => void;
}

export class WhatsAppManager extends EventEmitter {
  private clients: Map<string, Whatsapp> = new Map();

  async createSession(userId: string, sessionName: string): Promise<string> {
    try {
      const sessionId = `session_crm-${userId}`;
      
      // Check if session already exists
      const existingSession = await storage.getWhatsappSession(userId, sessionId);
      
      const sessionData = {
        userId,
        sessionName: sessionId,
        status: 'connecting' as const,
        phoneNumber: null,
        qrCode: null,
        isActive: true,
        lastActivity: new Date(),
      };

      let session;
      if (existingSession) {
        session = await storage.updateWhatsappSession(existingSession.id, sessionData);
      } else {
        session = await storage.createWhatsappSession(sessionData);
      }

      // Configuration for WPPConnect optimized for Replit
      const sessionOptions: SessionOptions = {
        session: sessionId,
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        browserWS: '',
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-web-security'
        ],
        catchQR: (base64Qr: string, asciiQR?: string) => {
          console.log('📱 WhatsApp QR Code generated for user:', userId);
          
          // Update session with QR code
          storage.updateWhatsappSession(session.id, {
            qrCode: base64Qr,
            status: 'connecting',
            lastActivity: new Date(),
          });

          // Emit QR code via WebSocket
          this.emit('qr', { userId, sessionId: session.id, qrCode: base64Qr });
        },
        statusFind: (statusSession: string, sessionInfo?: any) => {
          console.log('📱 WhatsApp Status changed:', statusSession, 'for user:', userId);
          
          let status = 'disconnected';
          let phoneNumber = null;

          switch (statusSession) {
            case 'isLogged':
              status = 'connected';
              if (sessionInfo && sessionInfo.me) {
                phoneNumber = sessionInfo.me.user || sessionInfo.me._serialized;
              }
              break;
            case 'notLogged':
              status = 'disconnected';
              break;
            case 'browserClose':
              status = 'error';
              break;
            case 'qrReadSuccess':
              status = 'connecting';
              break;
            case 'qrReadError':
              status = 'error';
              break;
            default:
              status = 'connecting';
          }

          // Update session status
          storage.updateWhatsappSession(session.id, {
            status,
            phoneNumber,
            lastActivity: new Date(),
          });

          // Emit status change via WebSocket
          this.emit('status', { userId, sessionId: session.id, status, phoneNumber });
        }
      };

      // Create WPPConnect client
      const client = await create(sessionOptions);

      // Store client reference
      this.clients.set(sessionId, client);

      // Set up message listeners
      client.onMessage(async (message: any) => {
        try {
          await this.handleIncomingMessage(userId, session.id, message);
        } catch (error) {
          console.error('Error handling incoming message:', error);
        }
      });

      return 'Session created successfully';
    } catch (error) {
      console.error('Error creating WhatsApp session:', error);
      throw new Error(`Failed to create WhatsApp session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendMessage(userId: string, to: string, text: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);
      
      if (!client) {
        throw new Error('WhatsApp session not found. Please create a session first.');
      }

      // Format phone number (ensure it has country code)
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      // Send message
      const result = await client.sendText(formattedNumber, text);
      
      // Store message in database
      const session = await storage.getWhatsappSession(userId, sessionId);
      if (session) {
        await storage.createWhatsappMessage({
          sessionId: session.id,
          messageId: result.id || 'unknown',
          chatId: formattedNumber,
          fromNumber: sessionId,
          toNumber: formattedNumber,
          content: text,
          messageType: 'text',
          direction: 'outgoing',
          isRead: true,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSessionStatus(userId: string): Promise<string> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);
      
      if (!client) {
        return 'disconnected';
      }

      const status = await client.getConnectionState();
      return status === 'CONNECTED' ? 'connected' : 'disconnected';
    } catch (error) {
      console.error('Error getting session status:', error);
      return 'disconnected';
    }
  }

  async getMessages(userId: string, chatId?: string, limit: number = 50): Promise<any[]> {
    try {
      const session = await storage.getWhatsappSession(userId, `session_crm-${userId}`);
      if (!session) {
        return [];
      }

      return await storage.getWhatsappMessages(session.id, chatId, limit);
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async closeSession(userId: string): Promise<void> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);
      
      if (client) {
        await client.close();
        this.clients.delete(sessionId);
      }

      // Update session status in database
      const session = await storage.getWhatsappSession(userId, sessionId);
      if (session) {
        await storage.updateWhatsappSession(session.id, {
          status: 'disconnected',
          isActive: false,
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      console.error('Error closing WhatsApp session:', error);
      throw new Error(`Failed to close session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleIncomingMessage(userId: string, sessionId: number, message: any): Promise<void> {
    try {
      await storage.createWhatsappMessage({
        sessionId,
        messageId: message.id,
        chatId: message.chatId,
        fromNumber: message.from,
        toNumber: message.to,
        content: message.body || message.content,
        messageType: message.type || 'text',
        direction: 'incoming',
        isRead: false,
        timestamp: new Date(message.timestamp * 1000),
      });

      // Emit message via WebSocket
      this.emit('message', { userId, sessionId, message });
    } catch (error) {
      console.error('Error storing incoming message:', error);
    }
  }
}

export const whatsAppManager = new WhatsAppManager();

// Set up WebSocket event listeners
whatsAppManager.on('qr', (data) => {
  webSocketManager.broadcastToUser(data.userId, {
    type: 'wa:qr',
    qrCode: data.qrCode,
    sessionId: data.sessionId
  });
});

whatsAppManager.on('status', (data) => {
  webSocketManager.broadcastToUser(data.userId, {
    type: 'wa:status',
    status: data.status,
    phoneNumber: data.phoneNumber,
    sessionId: data.sessionId
  });
});

whatsAppManager.on('message', (data) => {
  webSocketManager.broadcastToUser(data.userId, {
    type: 'wa:message',
    message: data.message,
    sessionId: data.sessionId
  });
});