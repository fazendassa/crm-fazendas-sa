import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import { EventEmitter } from 'events';
import { storage } from './storage';
import { InsertWhatsappMessage, InsertWhatsappSession } from '@shared/schema';
import path from 'path';
import fs from 'fs';

// WhatsApp client manager
class WhatsAppManager extends EventEmitter {
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
      // Check if session already exists in database
      const existingSession = await storage.getWhatsappSession(userId, sessionName);
      if (existingSession && existingSession.status === 'connected') {
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
        session = await storage.updateWhatsappSession(existingSession.id, sessionData);
      } else {
        session = await storage.createWhatsappSession(sessionData);
      }

      // Create WPPConnect client
      const client = await create({
        session: sessionId,
        catchQR: (base64Qr, asciiQR) => {
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
        statusFind: (statusSession, session) => {
          console.log('📱 WhatsApp Status changed:', statusSession, 'for user:', userId);
          
          let status = 'disconnected';
          let phoneNumber = null;

          switch (statusSession) {
            case 'isLogged':
              status = 'connected';
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

          // Emit status via WebSocket
          this.emit('status', { userId, sessionId: session.id, status, phoneNumber });
        },
        folderNameToken: this.sessionPath,
        mkdirFolderToken: this.sessionPath,
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        browserWS: '',
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        puppeteerOptions: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      // Store client reference
      this.clients.set(sessionId, client);

      // Set up message handlers
      this.setupMessageHandlers(client, userId, session.id);

      return 'Session created successfully';
    } catch (error) {
      console.error('❌ Error creating WhatsApp session:', error);
      
      // Update session status to error
      const existingSession = await storage.getWhatsappSession(userId, sessionName);
      if (existingSession) {
        await storage.updateWhatsappSession(existingSession.id, {
          status: 'error',
          lastActivity: new Date(),
        });
      }

      throw error;
    }
  }

  private setupMessageHandlers(client: Whatsapp, userId: string, sessionId: number) {
    // Handle incoming messages
    client.onMessage(async (message) => {
      try {
        console.log('📩 New message received:', message.from, message.body);

        const messageData: InsertWhatsappMessage = {
          sessionId,
          messageId: message.id,
          chatId: message.chatId,
          fromNumber: message.from,
          toNumber: message.to,
          content: message.body,
          messageType: message.type,
          mediaUrl: message.mediaUrl || null,
          direction: 'incoming',
          isRead: false,
          timestamp: new Date(message.timestamp * 1000),
        };

        // Save message to database
        const savedMessage = await storage.createWhatsappMessage(messageData);

        // Emit message via WebSocket
        this.emit('message', { 
          userId, 
          sessionId, 
          message: savedMessage,
          direction: 'incoming'
        });

      } catch (error) {
        console.error('❌ Error processing incoming message:', error);
      }
    });

    // Handle acknowledgment (message sent status)
    client.onAck(async (ack) => {
      try {
        console.log('✅ Message acknowledgment:', ack.id, ack.ack);
        
        // Update message status based on ack
        // ack.ack: 1 = sent, 2 = delivered, 3 = read
        if (ack.ack >= 2) {
          await storage.updateWhatsappMessageStatus(ack.id, true);
        }

        // Emit ack via WebSocket
        this.emit('ack', { userId, sessionId, messageId: ack.id, status: ack.ack });

      } catch (error) {
        console.error('❌ Error processing message acknowledgment:', error);
      }
    });

    // Handle state changes
    client.onStateChange((state) => {
      console.log('📱 WhatsApp State changed:', state);
      
      let status = 'disconnected';
      switch (state) {
        case 'CONNECTED':
          status = 'connected';
          break;
        case 'DISCONNECTED':
          status = 'disconnected';
          break;
        case 'OPENING':
          status = 'connecting';
          break;
        default:
          status = 'connecting';
      }

      // Update session status
      storage.updateWhatsappSession(sessionId, {
        status,
        lastActivity: new Date(),
      });

      // Emit status via WebSocket
      this.emit('status', { userId, sessionId, status });
    });
  }

  async sendMessage(userId: string, to: string, text: string): Promise<any> {
    const sessionId = `session_crm-${userId}`;
    const client = this.clients.get(sessionId);

    if (!client) {
      throw new Error('WhatsApp session not found. Please create a session first.');
    }

    try {
      // Send message via WhatsApp
      const result = await client.sendText(to, text);
      
      // Get session from database
      const session = await storage.getWhatsappSessionByUserId(userId);
      if (!session) {
        throw new Error('Session not found in database');
      }

      // Save outgoing message to database
      const messageData: InsertWhatsappMessage = {
        sessionId: session.id,
        messageId: result.id,
        chatId: result.chatId,
        fromNumber: result.from,
        toNumber: to,
        content: text,
        messageType: 'text',
        mediaUrl: null,
        direction: 'outgoing',
        isRead: false,
        timestamp: new Date(),
      };

      const savedMessage = await storage.createWhatsappMessage(messageData);

      // Emit message via WebSocket
      this.emit('message', { 
        userId, 
        sessionId: session.id, 
        message: savedMessage,
        direction: 'outgoing'
      });

      return result;
    } catch (error) {
      console.error('❌ Error sending WhatsApp message:', error);
      throw error;
    }
  }

  async getClient(userId: string): Promise<Whatsapp | null> {
    const sessionId = `session_crm-${userId}`;
    return this.clients.get(sessionId) || null;
  }

  async closeSession(userId: string): Promise<void> {
    const sessionId = `session_crm-${userId}`;
    const client = this.clients.get(sessionId);

    if (client) {
      await client.close();
      this.clients.delete(sessionId);
    }

    // Update session status in database
    const session = await storage.getWhatsappSessionByUserId(userId);
    if (session) {
      await storage.updateWhatsappSession(session.id, {
        status: 'disconnected',
        isActive: false,
        lastActivity: new Date(),
      });
    }
  }

  async getSessionStatus(userId: string): Promise<string> {
    const session = await storage.getWhatsappSessionByUserId(userId);
    return session?.status || 'disconnected';
  }

  async getMessages(userId: string, chatId?: string, limit: number = 50): Promise<any[]> {
    const session = await storage.getWhatsappSessionByUserId(userId);
    if (!session) {
      return [];
    }

    return await storage.getWhatsappMessages(session.id, chatId, limit);
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