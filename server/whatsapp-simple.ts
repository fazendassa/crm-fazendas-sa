import { EventEmitter } from 'events';
import { storage } from './storage';
import { webSocketManager } from './websocket';

export class SimpleWhatsAppManager extends EventEmitter {
  private activeSessions: Map<string, { status: string; qrCode?: string }> = new Map();

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

      // Simulate QR code generation for testing
      setTimeout(() => {
        // Generate a mock QR code (you would replace this with real QR generation)
        const mockQrCode = this.generateMockQrCode();
        
        // Update session with QR code
        storage.updateWhatsappSession(session.id, {
          qrCode: mockQrCode,
          status: 'connecting',
          lastActivity: new Date(),
        });

        // Emit QR code via WebSocket
        webSocketManager.broadcastToUser(userId, {
          type: 'wa:qr',
          qrCode: mockQrCode,
          sessionId: session.id
        });

        // Simulate connection status after some time
        setTimeout(() => {
          storage.updateWhatsappSession(session.id, {
            status: 'connected',
            phoneNumber: '+5511999999999',
            lastActivity: new Date(),
          });

          webSocketManager.broadcastToUser(userId, {
            type: 'wa:status',
            status: 'connected',
            phoneNumber: '+5511999999999',
            sessionId: session.id
          });
        }, 5000);

      }, 2000);

      this.activeSessions.set(sessionId, { status: 'connecting' });

      return 'Session created successfully';
    } catch (error) {
      console.error('Error creating WhatsApp session:', error);
      throw new Error(`Failed to create WhatsApp session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendMessage(userId: string, to: string, text: string): Promise<any> {
    try {
      const sessionId = `session_crm-${userId}`;
      const sessionInfo = this.activeSessions.get(sessionId);
      
      if (!sessionInfo || sessionInfo.status !== 'connected') {
        throw new Error('WhatsApp session not connected. Please connect first.');
      }

      // Format phone number
      let formattedNumber = to.replace(/\D/g, '');
      if (!formattedNumber.includes('@')) {
        formattedNumber = `${formattedNumber}@c.us`;
      }

      // Store message in database
      const session = await storage.getWhatsappSession(userId, sessionId);
      if (session) {
        await storage.createWhatsappMessage({
          sessionId: session.id,
          messageId: `msg_${Date.now()}`,
          chatId: formattedNumber,
          fromNumber: sessionId,
          toNumber: formattedNumber,
          content: text,
          messageType: 'text',
          direction: 'outgoing',
          isRead: true,
          timestamp: new Date(),
        });

        // Broadcast message via WebSocket
        webSocketManager.broadcastToUser(userId, {
          type: 'wa:message',
          message: {
            id: `msg_${Date.now()}`,
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

      return { success: true, messageId: `msg_${Date.now()}` };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSessionStatus(userId: string): Promise<string> {
    try {
      const sessionId = `session_crm-${userId}`;
      const sessionInfo = this.activeSessions.get(sessionId);
      
      return sessionInfo?.status || 'disconnected';
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
      
      // Remove from active sessions
      this.activeSessions.delete(sessionId);

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

  private generateMockQrCode(): string {
    // Generate a mock QR code as base64 SVG for testing
    const qrContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="white"/>
        <rect x="20" y="20" width="20" height="20" fill="black"/>
        <rect x="60" y="20" width="20" height="20" fill="black"/>
        <rect x="100" y="20" width="20" height="20" fill="black"/>
        <rect x="140" y="20" width="20" height="20" fill="black"/>
        <rect x="20" y="60" width="20" height="20" fill="black"/>
        <rect x="100" y="60" width="20" height="20" fill="black"/>
        <rect x="160" y="60" width="20" height="20" fill="black"/>
        <rect x="60" y="100" width="20" height="20" fill="black"/>
        <rect x="140" y="100" width="20" height="20" fill="black"/>
        <rect x="20" y="140" width="20" height="20" fill="black"/>
        <rect x="100" y="140" width="20" height="20" fill="black"/>
        <rect x="160" y="140" width="20" height="20" fill="black"/>
        <text x="100" y="190" text-anchor="middle" font-family="Arial" font-size="12" fill="gray">QR Code de Teste</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(qrContent).toString('base64')}`;
  }
}

export const whatsAppManager = new SimpleWhatsAppManager();