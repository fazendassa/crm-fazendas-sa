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

      // Close existing client if any
      const existingClient = this.clients.get(sessionId);
      if (existingClient) {
        console.log('🔄 Closing existing client');
        try {
          await existingClient.close();
        } catch (error) {
          console.log('⚠️ Error closing existing client:', error);
        }
        this.clients.delete(sessionId);
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
      const existingSession = await storage.getWhatsappSession(userId, sessionId);
      if (existingSession) {
        console.log('📱 Updating existing session');
        session = await storage.updateWhatsappSession(existingSession.id, sessionData);
      } else {
        console.log('📱 Creating new session');
        session = await storage.createWhatsappSession(sessionData);
      }

      // Clean up session directory completely to force new QR
      const sessionDir = path.join(this.sessionPath, sessionId);
      if (fs.existsSync(sessionDir)) {
        console.log('🧹 Cleaning session directory for fresh start');
        try {
          // Remove all session files to force QR generation
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.log('⚠️ Could not remove session directory:', error);
        }
      }

      // Configuration for WPPConnect optimized for Replit
      const client = await create({
        session: sessionId,
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: true,
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
          console.log('📱 QR Code preview:', base64Qr?.substring(0, 100) + '...');

          // Ensure QR code has proper data URL format
          let qrCodeData = base64Qr;
          if (!qrCodeData.startsWith('data:')) {
            qrCodeData = `data:image/png;base64,${base64Qr}`;
          }

          console.log('📱 Final QR Code format:', qrCodeData.substring(0, 50) + '...');

          // Update session with QR code
          storage.updateWhatsappSession(session.id, {
            qrCode: qrCodeData,
            status: 'connecting',
            lastActivity: new Date(),
          }).then(() => {
            console.log('✅ QR Code saved to database');
          }).catch(err => {
            console.error('❌ Error updating session with QR:', err);
          });

          // Emit QR code via WebSocket
          webSocketManager.broadcastToUser(userId, {
            type: 'wa:qr',
            qrCode: qrCodeData,
            sessionId: session.id
          });

          console.log('📡 QR Code sent via WebSocket to user:', userId);
        },
        statusFind: async (statusSession: string, sessionInfo?: any) => {
          const safeStatusSession = statusSession ? statusSession.toString() : 'unknown';
          console.log('📱 WhatsApp Status changed:', safeStatusSession, 'for user:', userId);
          console.log('📱 Session info:', sessionInfo);

          let status = 'disconnected';
          let phoneNumber = null;

          switch (safeStatusSession) {
            case 'isLogged':
              status = 'connected';
              // Try to get phone number from session info
              if (sessionInfo) {
                phoneNumber = sessionInfo.me?.user || 
                             sessionInfo.me?._serialized || 
                             sessionInfo.wid?.user ||
                             sessionInfo.wid?._serialized;
              }
              
              // If still no phone number, try to get from client
              if (!phoneNumber && sessionId) {
                const client = this.clients.get(sessionId);
                if (client) {
                  try {
                    const hostDevice = await client.getHostDevice();
                    phoneNumber = hostDevice?.id?.user || hostDevice?.id?._serialized;
                  } catch (err) {
                    console.log('Could not get host device info:', err);
                  }
                }
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
          try {
            await storage.updateWhatsappSession(session.id, {
              status,
              phoneNumber,
              lastActivity: new Date(),
            });
          } catch (err) {
            console.error('Error updating session status:', err);
          }

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
      try {
        const existingSession = await storage.getWhatsappSession(userId, sessionId);
        if (existingSession) {
          await storage.updateWhatsappSession(existingSession.id, {
            status: 'error',
            lastActivity: new Date(),
          });
        }
      } catch (updateError) {
        console.error('Error updating session status to error:', updateError);
      }

      throw new Error(`Failed to create WhatsApp session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendMessage(userId: string, to: string, text: string, messageType: string = 'text'): Promise<any> {
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

      console.log('📤 Sending message to:', formattedNumber, 'content:', text, 'type:', messageType);

      // Send message
      const result = await client.sendText(formattedNumber, text);
      console.log('✅ Message sent result:', result);

      // Get session from database
      const sessions = await storage.getWhatsappSessions(userId);
      const session = sessions.find(s => s.sessionName === sessionId || s.userId === userId);
      
      if (session) {
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: result.from || sessionId,
          toNumber: formattedNumber,
          content: text,
          messageType: messageType as 'text' | 'image' | 'audio' | 'video' | 'file',
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);
        console.log('💾 Message saved to database:', savedMessage.id);

        // Broadcast message via WebSocket
        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: savedMessage,
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id || `msg_${Date.now()}` };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendMedia(userId: string, to: string, media: string, mediaType: 'image' | 'video' | 'audio' | 'document', caption?: string, fileName?: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found. Please create a session first.');
      }

      // Format phone number
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      console.log('📤 Sending media to:', formattedNumber, 'type:', mediaType);

      let result;
      switch (mediaType) {
        case 'image':
          result = await client.sendImage(formattedNumber, media, fileName || 'image.jpg', caption);
          break;
        case 'video':
          result = await client.sendVideoAsGif(formattedNumber, media, fileName || 'video.mp4', caption);
          break;
        case 'audio':
          result = await client.sendVoice(formattedNumber, media);
          break;
        case 'document':
          result = await client.sendFile(formattedNumber, media, fileName || 'document');
          break;
        default:
          throw new Error('Unsupported media type');
      }

      // Save to database
      const sessions = await storage.getWhatsappSessions(userId);
      const session = sessions.find(s => s.sessionName === sessionId || s.userId === userId);
      
      if (session) {
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: result.from || sessionId,
          toNumber: formattedNumber,
          content: caption || `${mediaType} sent`,
          messageType: mediaType,
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
          mediaUrl: media
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);

        // Broadcast via WebSocket
        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: savedMessage,
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id || `msg_${Date.now()}` };
    } catch (error) {
      console.error('Error sending media:', error);
      throw new Error(`Failed to send media: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendSticker(userId: string, to: string, stickerPath: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      const result = await client.sendImageAsSticker(formattedNumber, stickerPath);
      
      // Save to database
      const sessions = await storage.getWhatsappSessions(userId);
      const session = sessions.find(s => s.sessionName === sessionId || s.userId === userId);
      
      if (session) {
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: result.from || sessionId,
          toNumber: formattedNumber,
          content: 'Sticker sent',
          messageType: 'sticker' as any,
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
          mediaUrl: stickerPath
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);

        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: savedMessage,
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Error sending sticker:', error);
      throw new Error(`Failed to send sticker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendStickerGif(userId: string, to: string, gifPath: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      const result = await client.sendVideoAsGif(formattedNumber, gifPath, 'sticker.gif', '');
      
      // Save to database similar to sendSticker
      const sessions = await storage.getWhatsappSessions(userId);
      const session = sessions.find(s => s.sessionName === sessionId || s.userId === userId);
      
      if (session) {
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: result.from || sessionId,
          toNumber: formattedNumber,
          content: 'GIF Sticker sent',
          messageType: 'sticker' as any,
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
          mediaUrl: gifPath
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);

        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: savedMessage,
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Error sending GIF sticker:', error);
      throw new Error(`Failed to send GIF sticker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendContact(userId: string, to: string, contactId: string, name: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      const result = await client.sendContactVcard(formattedNumber, contactId, name);
      
      // Save to database
      const sessions = await storage.getWhatsappSessions(userId);
      const session = sessions.find(s => s.sessionName === sessionId || s.userId === userId);
      
      if (session) {
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: result.from || sessionId,
          toNumber: formattedNumber,
          content: `Contact shared: ${name}`,
          messageType: 'contact' as any,
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);

        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: savedMessage,
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Error sending contact:', error);
      throw new Error(`Failed to send contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async forwardMessage(userId: string, to: string, messageId: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      const result = await client.forwardMessages(formattedNumber, [messageId], false);
      
      // Save to database
      const sessions = await storage.getWhatsappSessions(userId);
      const session = sessions.find(s => s.sessionName === sessionId || s.userId === userId);
      
      if (session) {
        const messageData = {
          sessionId: session.id,
          messageId: result.id || `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: result.from || sessionId,
          toNumber: formattedNumber,
          content: 'Forwarded message',
          messageType: 'text',
          direction: 'outgoing' as const,
          isRead: true,
          timestamp: new Date(),
        };

        const savedMessage = await storage.createWhatsappMessage(messageData);

        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: savedMessage,
          sessionId: session.id
        });
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Error forwarding message:', error);
      throw new Error(`Failed to forward message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getContacts(userId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const contacts = await client.getAllContacts();
      return contacts.map(contact => ({
        id: contact.id,
        name: contact.name || contact.pushname || contact.shortName,
        phone: contact.id.replace('@c.us', ''),
        isMyContact: contact.isMyContact,
        isGroup: contact.isGroup,
        profilePic: contact.profilePicThumb || null
      }));
    } catch (error) {
      console.error('Error getting contacts:', error);
      throw new Error(`Failed to get contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChats(userId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const chats = await client.getAllChats();
      return chats.map(chat => ({
        id: chat.id,
        name: chat.name || chat.formattedTitle,
        isGroup: chat.isGroup,
        lastMessage: chat.lastMessage,
        unreadCount: chat.unreadCount,
        timestamp: chat.t,
        profilePic: chat.contact?.profilePicThumb || null
      }));
    } catch (error) {
      console.error('Error getting chats:', error);
      throw new Error(`Failed to get chats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroups(userId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const groups = await client.getAllGroups();
      return groups.map(group => ({
        id: group.id,
        name: group.name || group.formattedTitle,
        participants: group.participants?.length || 0,
        admins: group.participants?.filter(p => p.isAdmin)?.length || 0,
        description: group.groupMetadata?.desc,
        profilePic: group.contact?.profilePicThumb || null
      }));
    } catch (error) {
      console.error('Error getting groups:', error);
      throw new Error(`Failed to get groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGroupMembers(userId: string, groupId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const members = await client.getGroupMembers(groupId);
      return members.map(member => ({
        id: member.id,
        phone: member.id.replace('@c.us', ''),
        isAdmin: member.isAdmin,
        isSuperAdmin: member.isSuperAdmin
      }));
    } catch (error) {
      console.error('Error getting group members:', error);
      throw new Error(`Failed to get group members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBlockList(userId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const blockedContacts = await client.getBlockList();
      return blockedContacts.map(contact => ({
        id: contact,
        phone: contact.replace('@c.us', '')
      }));
    } catch (error) {
      console.error('Error getting block list:', error);
      throw new Error(`Failed to get block list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async blockContact(userId: string, contactId: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const result = await client.blockContact(contactId);
      return { success: true, result };
    } catch (error) {
      console.error('Error blocking contact:', error);
      throw new Error(`Failed to block contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async unblockContact(userId: string, contactId: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const result = await client.unblockContact(contactId);
      return { success: true, result };
    } catch (error) {
      console.error('Error unblocking contact:', error);
      throw new Error(`Failed to unblock contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  async deleteSession(userId: string, sessionId: number): Promise<void> {
    try {
      const sessionKey = `session_crm-${userId}`;
      const client = this.clients.get(sessionKey);

      if (client) {
        await client.close();
        this.clients.delete(sessionKey);
      }

      // Delete session from database
      await storage.deleteWhatsappSession(sessionId);

      // Notify via WebSocket
      webSocketManager.broadcastToUser(userId, {
        type: 'wa:status',
        status: 'disconnected',
        sessionId: sessionId
      });
    } catch (error) {
      console.error('Error deleting WhatsApp session:', error);
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleIncomingMessage(userId: string, sessionId: number, message: any): Promise<void> {
    try {
      console.log('📨 Processing incoming message:', {
        messageId: message.id,
        from: message.from,
        body: message.body?.substring(0, 50)
      });

      const messageData = {
        sessionId,
        messageId: message.id,
        chatId: message.chatId || message.from,
        fromNumber: message.from,
        toNumber: message.to || `session_crm-${userId}`,
        content: message.body || message.content || '',
        messageType: (message.type || 'text') as 'text' | 'image' | 'audio' | 'video' | 'file',
        direction: 'incoming' as const,
        isRead: false,
        timestamp: new Date(message.timestamp ? message.timestamp * 1000 : Date.now()),
        mediaUrl: message.mediaUrl || null
      };

      const savedMessage = await storage.createWhatsappMessage(messageData);
      console.log('💾 Message saved to database:', savedMessage.id);

      // Emit message via WebSocket
      webSocketManager.broadcastToUser(userId, {
        type: 'wa:message',
        message: savedMessage,
        sessionId
      });

      console.log('📡 Message broadcasted via WebSocket');
    } catch (error) {
      console.error('❌ Error storing incoming message:', error);
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

  async getContactsForSync(userId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const contacts = await client.getAllContacts();
      console.log('📇 Raw contacts from WhatsApp:', contacts.length);

      // Buscar também os chats para ter informações mais atualizadas
      const chats = await client.getAllChats();
      const chatMap = new Map();
      
      chats.forEach(chat => {
        if (!chat.isGroup) {
          chatMap.set(chat.id, {
            name: chat.name || chat.formattedTitle,
            lastMessageTime: chat.t,
            profilePic: chat.contact?.profilePicThumb
          });
        }
      });

      return contacts
        .filter(contact => contact && !contact.isGroup && contact.isMyContact) // Apenas contatos pessoais válidos
        .map(contact => {
          // Verificar se contact.id existe e é uma string
          const contactId = contact.id || '';
          if (typeof contactId !== 'string') {
            console.warn('Invalid contact.id:', contactId, 'for contact:', contact);
            return null;
          }

          const chatInfo = chatMap.get(contactId);
          const cleanPhone = contactId.replace('@c.us', '');
          
          // Priorizar nome do chat, depois pushname, depois nome do contato
          let name = chatInfo?.name || contact.pushname || contact.name || contact.shortName;
          
          // Se ainda não tem nome, criar um nome formatado do número
          if (!name || name === cleanPhone) {
            if (cleanPhone.length >= 10) {
              const countryCode = cleanPhone.slice(0, 2);
              const areaCode = cleanPhone.slice(2, 4);
              const number = cleanPhone.slice(4);
              name = `+${countryCode} ${areaCode} ${number}`;
            } else {
              name = cleanPhone;
            }
          }

          return {
            id: contactId,
            name: name,
            phone: cleanPhone,
            isMyContact: contact.isMyContact,
            isGroup: contact.isGroup,
            profilePic: chatInfo?.profilePic || contact.profilePicThumb || null,
            lastActivity: chatInfo?.lastMessageTime || null
          };
        })
        .filter(contact => contact !== null)
        .sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0)); // Ordenar por última atividade
    } catch (error) {
      console.error('Error getting contacts:', error);
      return [];
    }
  }

  async getChatsForSync(userId: string): Promise<any[]> {
    try {
      const sessionId = `session_crm-${userId}`;
      const client = this.clients.get(sessionId);

      if (!client) {
        throw new Error('WhatsApp session not found');
      }

      const chats = await client.getAllChats();
      console.log('💬 Raw chats from WhatsApp:', chats.length);

      return chats.map(chat => ({
        id: chat.id,
        name: chat.name || chat.formattedTitle || chat.id.replace('@c.us', ''),
        isGroup: chat.isGroup,
        lastMessage: chat.lastMessage ? {
          content: chat.lastMessage.body || '',
          timestamp: new Date(chat.lastMessage.t * 1000),
          fromMe: chat.lastMessage.fromMe
        } : null,
        unreadCount: chat.unreadCount || 0,
        timestamp: chat.t ? new Date(chat.t * 1000) : new Date(),
        profilePic: chat.contact?.profilePicThumb || null
      }));
    } catch (error) {
      console.error('Error getting chats:', error);
      return [];
    }
  }
}

export const whatsAppManager = new WhatsAppManager();