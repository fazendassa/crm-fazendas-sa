import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-minimal";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { whatsAppManager } from "./whatsapp-service";
import { webSocketManager } from "./websocket";
import multer from "multer";

const upload = multer();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server
  webSocketManager.setup(httpServer);
  
  // Setup authentication first
  await setupAuth(app);
  
  // Basic routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // WhatsApp routes
  app.get("/api/whatsapp/sessions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      console.log('Getting WhatsApp sessions for user:', userId);
      
      const sessions = await storage.getWhatsappSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error getting WhatsApp sessions:", error);
      res.status(500).json({ message: "Failed to get WhatsApp sessions" });
    }
  });

  app.post("/api/whatsapp/sessions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const sessionName = 'session_crm-' + userId;
      
      console.log('Creating WhatsApp session for user:', userId);

      const qrCode = await whatsAppManager.createSession(userId, sessionName);
      
      res.json({ 
        message: "Session creation initiated",
        qrCode: qrCode,
        sessionName: sessionName
      });
    } catch (error) {
      console.error("Error creating WhatsApp session:", error);
      res.status(500).json({ message: "Failed to create WhatsApp session" });
    }
  });

  app.delete("/api/whatsapp/sessions/:sessionId", isAuthenticated, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const userId = (req.user as any).claims.sub;
      
      console.log('Deleting WhatsApp session:', sessionId, 'for user:', userId);
      
      // Delete from WhatsApp service
      await whatsAppManager.deleteSession(userId);
      
      // Delete from database
      await storage.deleteWhatsappSession(sessionId);
      
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting WhatsApp session:", error);
      res.status(500).json({ message: "Failed to delete WhatsApp session" });
    }
  });

  app.get("/api/whatsapp/sessions/:sessionId/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const sessionId = parseInt(req.params.sessionId);
      const limit = parseInt(req.query.limit as string) || 100;

      console.log('Getting messages for session', sessionId, 'user', userId);

      const messages = await storage.getWhatsappMessages(sessionId, undefined, limit);

      // Transform messages to match expected format
      const formattedMessages = messages.map(msg => {
        return {
          id: msg.messageId,
          from: msg.fromNumber,
          to: msg.toNumber,
          body: msg.content,
          timestamp: msg.timestamp,
          type: msg.messageType,
          isRead: msg.isRead,
          createdAt: msg.createdAt || msg.timestamp
        };
      });

      console.log('Returning', formattedMessages.length, 'messages');
      res.json(formattedMessages);
    } catch (error) {
      console.error("Error getting WhatsApp messages for session:", error);
      res.status(500).json({ message: "Failed to get WhatsApp messages", error: error.message });
    }
  });

  app.get("/api/whatsapp/sessions/:sessionId/contacts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const sessionId = parseInt(req.params.sessionId);
      console.log('Getting contacts for user:', userId);

      // Check if session exists and is connected
      const session = await storage.getWhatsappSession(userId, 'session_crm-' + userId);
      if (!session || session.status !== 'connected') {
        console.log('Session not connected, returning empty contacts');
        return res.json([]);
      }

      const contacts = await whatsAppManager.getContactsForSync(userId);
      console.log('Contacts found:', contacts.length);

      res.json(contacts);
    } catch (error) {
      console.error("Error getting WhatsApp contacts:", error);
      res.json([]); // Return empty array instead of error
    }
  });

  app.post("/api/whatsapp/send", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { to, message } = req.body;

      console.log('Sending WhatsApp message from user:', userId);

      const result = await whatsAppManager.sendMessage(userId, to, message);
      res.json(result);
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Company routes
  app.get("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const companies = await storage.getCompanies(search, limit, offset);
      res.json(companies);
    } catch (error) {
      console.error("Error getting companies:", error);
      res.status(500).json({ message: "Failed to get companies" });
    }
  });

  app.post("/api/companies", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.createCompany(req.body);
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Contact routes
  app.get("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string;
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const contacts = await storage.getContacts(search, companyId, limit, offset);
      res.json(contacts);
    } catch (error) {
      console.error("Error getting contacts:", error);
      res.status(500).json({ message: "Failed to get contacts" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const contact = await storage.createContact(req.body);
      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Deal routes
  app.get("/api/deals", isAuthenticated, async (req, res) => {
    try {
      const stage = req.query.stage as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;
      
      const deals = await storage.getDeals(stage, limit, offset, contactId);
      res.json(deals);
    } catch (error) {
      console.error("Error getting deals:", error);
      res.status(500).json({ message: "Failed to get deals" });
    }
  });

  app.post("/api/deals", isAuthenticated, async (req, res) => {
    try {
      const deal = await storage.createDeal(req.body);
      res.json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  // Pipeline routes
  app.get("/api/pipelines", isAuthenticated, async (req, res) => {
    try {
      const pipelines = await storage.getPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error getting pipelines:", error);
      res.status(500).json({ message: "Failed to get pipelines" });
    }
  });

  app.get("/api/pipeline-stages", isAuthenticated, async (req, res) => {
    try {
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      const stages = await storage.getPipelineStages(pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Error getting pipeline stages:", error);
      res.status(500).json({ message: "Failed to get pipeline stages" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/metrics", isAuthenticated, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting dashboard metrics:", error);
      res.status(500).json({ message: "Failed to get dashboard metrics" });
    }
  });

  // Auth setup
  setupAuth(app);

  return httpServer;
}