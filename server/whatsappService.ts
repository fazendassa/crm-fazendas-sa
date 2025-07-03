import * as wppconnect from '@wppconnect-team/wppconnect';
import { Server as SocketIOServer } from 'socket.io';
import { storage } from './storage';
import type { WhatsappSession, InsertWhatsappMessage, InsertWhatsappContact } from '@shared/schema';

interface WhatsappClient {
  client: wppconnect.Whatsapp;
  sessionName: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  phoneNumber?: string;
}

class WhatsappService {
  private clients: Map<string, WhatsappClient> = new Map();
  private io?: SocketIOServer;

  setSocketIO(io: SocketIOServer) {
    this.io = io;
  }

  async createSession(sessionName: string): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      if (this.clients.has(sessionName)) {
        return { success: false, error: 'Session already exists in memory' };
      }

      // Check if Chrome/Chromium is available
      const fs = require('fs');
      const chromePaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/opt/google/chrome/google-chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable'
      ];
      
      let chromePath = null;
      for (const path of chromePaths) {
        if (fs.existsSync(path)) {
          chromePath = path;
          break;
        }
      }

      if (!chromePath) {
        return { success: false, error: 'Chrome/Chromium not found. Please install Chromium: apt-get install chromium-browser' };
      }

      let qrCode: string | undefined;

      const client = await wppconnect.create({
        session: sessionName,
        catchQR: (base64Qr, asciiQR, attempt, urlCode) => {
          console.log('QR CODE received for session:', sessionName);
          qrCode = base64Qr;
          // Emit QR code to frontend
          this.io?.emit('qr-code', { sessionName, qrCode: base64Qr });
        },
        statusFind: (statusSession, session) => {
          console.log('Status Session: ', statusSession);
          console.log('Session name: ', session);

          this.updateSessionStatus(sessionName, statusSession as any);
          this.io?.emit('session-status', { sessionName, status: statusSession });

          if (statusSession === 'authenticated' || statusSession === 'isLogged') {
            this.updateSessionStatus(sessionName, 'connected');
            this.io?.emit('session-status', { sessionName, status: 'connected' });
          }
        },
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        disableWelcome: true,
        updatesLog: false,
        autoClose: 60000,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images'
        ],
        executablePath: chromePath,
      });

      // Set up message listener
      client.onMessage(async (message) => {
        try {
          await this.handleIncomingMessage(sessionName, message);
        } catch (error) {
          console.error('Error handling incoming message:', error);
        }
      });

      // Store client
      this.clients.set(sessionName, {
        client,
        sessionName,
        status: 'connecting',
      });

      return { success: true, qrCode };
    } catch (error) {
      console.error('Error creating WhatsApp session:', error);
      await this.updateSessionStatus(sessionName, 'error');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async disconnectSession(sessionName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const clientData = this.clients.get(sessionName);
      if (!clientData) {
        // Even if not in memory, try to update database status
        await this.updateSessionStatus(sessionName, 'disconnected');
        this.io?.emit('session-status', { sessionName, status: 'disconnected' });
        return { success: true };
      }

      try {
        await clientData.client.close();
      } catch (closeError) {
        console.warn('Error closing client:', closeError);
      }
      
      this.clients.delete(sessionName);

      await this.updateSessionStatus(sessionName, 'disconnected');
      this.io?.emit('session-status', { sessionName, status: 'disconnected' });

      return { success: true };
    } catch (error) {
      console.error('Error disconnecting WhatsApp session:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendMessage(sessionName: string, phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const clientData = this.clients.get(sessionName);
      if (!clientData || clientData.status !== 'connected') {
        return { success: false, error: 'Session not connected' };
      }

      // Format phone number for WhatsApp (remove spaces, add country code if needed)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);

      await clientData.client.sendText(`${formattedNumber}@c.us`, message);

      // Save message to database
      const session = await this.getSessionByName(sessionName);
      if (session) {
        await storage.createWhatsappMessage({
          sessionId: session.id,
          messageId: `${Date.now()}-${Math.random()}`,
          fromNumber: clientData.phoneNumber || session.phoneNumber || '',
          toNumber: formattedNumber,
          messageType: 'text',
          content: message,
          timestamp: new Date(),
          isIncoming: false,
          status: 'sent',
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async handleIncomingMessage(sessionName: string, message: any): Promise<void> {
    try {
      const session = await this.getSessionByName(sessionName);
      if (!session) return;

      // Extract phone number from message
      const fromNumber = message.from.replace('@c.us', '');

      // Create or update WhatsApp contact
      let whatsappContact = await storage.getWhatsappContact(fromNumber);
      if (!whatsappContact) {
        const contactData: InsertWhatsappContact = {
          phoneNumber: fromNumber,
          name: message.sender?.pushname || fromNumber,
          profilePic: message.sender?.profilePic,
          lastSeen: new Date(),
          isBlocked: false,
        };

        // Try to find existing CRM contact by phone
        const existingContacts = await storage.getContacts(fromNumber);
        if (existingContacts.length > 0) {
          contactData.contactId = existingContacts[0].id;
        }

        whatsappContact = await storage.createWhatsappContact(contactData);
      } else {
        // Update last seen
        await storage.updateWhatsappContact(whatsappContact.id, {
          lastSeen: new Date(),
          name: message.sender?.pushname || whatsappContact.name,
        });
      }

      // Save message to database
      const messageData: InsertWhatsappMessage = {
        sessionId: session.id,
        messageId: message.id,
        fromNumber,
        toNumber: session.phoneNumber || '',
        messageType: message.type || 'text',
        content: message.body || message.caption,
        mediaUrl: message.mediaData?.url,
        timestamp: new Date(message.timestamp * 1000),
        isIncoming: true,
        contactId: whatsappContact.contactId,
        status: 'received',
      };

      await storage.createWhatsappMessage(messageData);

      // Emit to frontend
      this.io?.emit('new-message', {
        sessionName,
        message: messageData,
        contact: whatsappContact,
      });

    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private async updateSessionStatus(sessionName: string, status: 'connected' | 'disconnected' | 'connecting' | 'error'): Promise<void> {
    try {
      const session = await this.getSessionByName(sessionName);
      if (session) {
        await storage.updateWhatsappSession(session.id, {
          status,
          lastActivity: new Date(),
        });

        // Update client status
        const clientData = this.clients.get(sessionName);
        if (clientData) {
          clientData.status = status;
        }
      }
    } catch (error) {
      console.error('Error updating session status:', error);
    }
  }

  private async getSessionByName(sessionName: string): Promise<WhatsappSession | undefined> {
    const sessions = await storage.getWhatsappSessions();
    return sessions.find(s => s.sessionName === sessionName);
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Add country code if not present (assuming Brazil +55)
    if (cleaned.length === 11 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }

  getConnectedSessions(): string[] {
    return Array.from(this.clients.entries())
      .filter(([_, client]) => client.status === 'connected')
      .map(([sessionName]) => sessionName);
  }

  isSessionConnected(sessionName: string): boolean {
    const client = this.clients.get(sessionName);
    return client?.status === 'connected' || false;
  }
}

export const whatsappService = new WhatsappService();