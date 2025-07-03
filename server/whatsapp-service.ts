import { create, Whatsapp, SocketState } from '@wppconnect-team/wppconnect';
import { EventEmitter } from 'events';
import { storage } from './storage';
import { webSocketManager } from './websocket';
import path from 'path';
import fs from 'fs';

export class WhatsAppManager extends EventEmitter {
  private clients: Map<string, Whatsapp> = new Map();
  private sessionPath: string;

  constructor() {
    super();
    this.sessionPath = path.join(process.cwd(), 'whatsapp-sessions');
    this.ensureSessionDir();
  }

  private ensureSessionDir() {
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }
  }

  async createSession(userId: string, sessionName: string): Promise<string> {
    const sessionId = `session_crm-${userId}`;

    try {
      console.log('📱 Creating WhatsApp session for user:', userId, 'with name:', sessionName);

      // Check if session already exists in database
      const existingSession = await storage.getWhatsappSession(userId, sessionName);
      if (existingSession && existingSession.status === 'connected') {
        console.log('📱 Session already connected');
        return 'Session already connected';
      }

      // Create or update session in database
      const sessionData: InsertWhatsappSession = {
        userId,
        sessionName,
        status: 'connecting',
        phoneNumber: null,
        qrCode: null,
        isActive: true,
        lastActivity: new Date(),
      };

      let session;
      if (existingSession) {
        console.log('📱 Updating existing session');
        session = await storage.updateWhatsappSession(existingSession.id, sessionData);
      } else {
        console.log('📱 Creating new session');
        session = await storage.createWhatsappSession(sessionData);
      }

      // Clean up session directory
      const sessionDir = path.join(this.sessionPath, sessionId);
      if (fs.existsSync(sessionDir)) {
        const lockFile = path.join(sessionDir, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
          try {
            fs.unlinkSync(lockFile);
            console.log('🧹 Removed existing lock file for session:', sessionId);
          } catch (error) {
            console.log('⚠️ Could not remove lock file:', error);
          }
        }
      }

      // Configuration for WPPConnect optimized for Replit
      const client = await create({
        session: sessionId,
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        browserWS: '',
        executablePath: process.env.CHROME_BIN || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
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
          '--disable-web-security',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--no-default-browser-check'
        ],
        folderNameToken: this.sessionPath,
        mkdirFolderToken: this.sessionPath,
        catchQR: (base64Qr: string, asciiQR?: string) => {
          console.log('📱 WhatsApp QR Code generated for user:', userId);
          console.log('📱 QR Code length:', base64Qr?.length);

          // Update session with QR code
          storage.updateWhatsappSession(session.id, {
            qrCode: base64Qr,
            status: 'connecting',
            lastActivity: new Date(),
          }).catch(err => console.error('Error updating session with QR:', err));

          // Emit QR code via WebSocket
          webSocketManager.broadcastToUser(userId, {
            type: 'wa:qr',
            qrCode: base64Qr,
            sessionId: session.id
          });

          console.log('📡 QR Code sent via WebSocket to user:', userId);
        },
        statusFind: (statusSession: string, sessionInfo?: any) => {
          console.log('📱 WhatsApp Status changed:', statusSession, 'for user:', userId);
          console.log('📱 Session info:', sessionInfo);

          let status = 'disconnected';
          let phoneNumber = null;

          switch (statusSession) {
            case 'isLogged':
              status = 'connected';
              // Try to get phone number from session info
              if (sessionInfo) {
                phoneNumber = sessionInfo.me?.user || 
                             sessionInfo.me?._serialized || 
                             sessionInfo.wid?.user ||
                             sessionInfo.wid?._serialized;
              }
              console.log('📱 Connected with phone:', phoneNumber);
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
            case 'inChat':
              status = 'connected';
              break;
            default:
              status = 'connecting';
          }

          // Update session status
          storage.updateWhatsappSession(session.id, {
            status,
            phoneNumber,
            lastActivity: new Date(),
          }).catch(err => console.error('Error updating session status:', err));

          // Emit status change via WebSocket
          webSocketManager.broadcastToUser(userId, {
            type: 'wa:status',
            status,
            phoneNumber,
            sessionId: session.id
          });

          console.log('📡 Status update sent via WebSocket:', { status, phoneNumber });
        }
      });

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

      // Handle acknowledgment (message sent status)
      client.onAck(async (ack: any) => {
        try {
          console.log('✅ Message acknowledgment:', ack.id, ack.ack);

          // Update message status based on ack
          if (ack.ack >= 2) {
            await storage.updateWhatsappMessageStatus(ack.id, true);
          }

          // Emit ack via WebSocket
          webSocketManager.broadcastToUser(userId, {
            type: 'wa:ack',
            sessionId: session.id,
            messageId: ack.id,
            status: ack.ack
          });

        } catch (error) {
          console.error('❌ Error processing message acknowledgment:', error);
        }
      });

      return 'Session created successfully';
    } catch (error) {
      console.error('Error creating WhatsApp session:', error);

      // Update session status to error
      const existingSession = await storage.getWhatsappSession(userId, `session_crm-${userId}`);
      if (existingSession) {
        await storage.updateWhatsappSession(existingSession.id, {
          status: 'error',
          lastActivity: new Date(),
        });
      }

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
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: sessionId,
          toNumber: formattedNumber,
          content: text,
          messageType: 'text',
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);

        // Broadcast message via WebSocket
        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: {
            id: savedMessage.id,
            chatId: formattedNumber,
            from: sessionId,
            to: formattedNumber,
            content: text,
            type: 'text',
            direction: 'outgoing',
            timestamp: new Date()
          },
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id || `msg_${Date.now()}` };
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

        // Notify via WebSocket
        webSocketManager.broadcastToUser(userId, {
          type: 'wa:status',
          status: 'disconnected',
          sessionId: session.id
        });
      }
    } catch (error) {
      console.error('Error closing WhatsApp session:', error);
      throw new Error(`Failed to close session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleIncomingMessage(userId: string, sessionId: number, message: any): Promise<void> {
    try {
      const messageData = {
        sessionId,
        messageId: message.id,
        chatId: message.chatId,
        fromNumber: message.from,
        toNumber: message.to,
        content: message.body || message.content,
        messageType: message.type || 'text',
        direction: 'incoming' as const,
        isRead: false,
        timestamp: new Date(message.timestamp * 1000),
      };

      const savedMessage = await storage.createWhatsappMessage(messageData);

      // Emit message via WebSocket
      webSocketManager.broadcastToUser(userId, {
        type: 'wa:message',
        message: savedMessage,
        sessionId
      });
    } catch (error) {
      console.error('Error storing incoming message:', error);
    }
  }

  // Additional WhatsApp functions
  async sendImage(userId: string, to: string, imagePath: string, caption?: string): Promise<any> {
    const sessionId = `session_crm-${userId}`;
    const client = this.clients.get(sessionId);

    if (!client) {
      throw new Error('WhatsApp session not found');
    }

    return await client.sendImage(to, imagePath, 'image.jpg', caption);
  }

  async sendFile(userId: string, to: string, filePath: string, fileName?: string): Promise<any> {
    const sessionId = `session_crm-${userId}`;
    const client = this.clients.get(sessionId);

    if (!client) {
      throw new Error('WhatsApp session not found');
    }

    return await client.sendFile(to, filePath, fileName);
  }

  async getContacts(userId: string): Promise<any[]> {
    const sessionId = `session_crm-${userId}`;
    const client = this.clients.get(sessionId);

    if (!client) {
      throw new Error('WhatsApp session not found');
    }

    return await client.getAllContacts();
  }

  async getChats(userId: string): Promise<any[]> {
    const sessionId = `session_crm-${userId}`;
    const client = this.clients.get(sessionId);

    if (!client) {
      throw new Error('WhatsApp session not found');
    }

    return await client.getAllChats();
  }
}

export const whatsAppManager = new WhatsAppManager();