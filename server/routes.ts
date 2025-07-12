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

      // Ensure we always return an array
      const sessionsArray = Array.isArray(sessions) ? sessions : [];
      console.log('Returning sessions:', sessionsArray.length);

      res.json(sessionsArray);
    } catch (error) {
      console.error("Error getting WhatsApp sessions:", error);
      res.status(500).json({ message: "Failed to get WhatsApp sessions" });
    }
  });

  app.post("/api/whatsapp/create-session", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { sessionName } = req.body;

      if (!sessionName || !sessionName.trim()) {
        return res.status(400).json({ 
          success: false, 
          message: "Nome da sessão é obrigatório" 
        });
      }

      console.log('Creating WhatsApp session for user:', userId, 'with name:', sessionName);

      const result = await whatsAppManager.createSession(userId, sessionName.trim());

      res.json({ 
        success: true,
        message: "Sessão criada com sucesso. Aguarde o QR Code aparecer.",
        sessionName: sessionName.trim()
      });
    } catch (error) {
      console.error("Error creating WhatsApp session:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Falha ao criar sessão do WhatsApp" 
      });
    }
  });

  app.get("/api/whatsapp/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const sessionId = req.query.sessionId ? parseInt(req.query.sessionId as string) : undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!sessionId) {
        return res.json({ messages: [] });
      }

      console.log('Getting messages for session', sessionId, 'user', userId);

      const messages = await storage.getWhatsappMessages(sessionId, undefined, limit);

      res.json({ messages: messages || [] });
    } catch (error) {
      console.error("Error getting WhatsApp messages:", error);
      res.json({ messages: [] });
    }
  });

  app.delete("/api/whatsapp/session", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;

      console.log('Deleting WhatsApp session for user:', userId);

      // Get user sessions first
      const sessions = await storage.getWhatsappSessions(userId);

      if (sessions && sessions.length > 0) {
        // Delete from WhatsApp service
        await whatsAppManager.closeSession(userId);

        // Delete from database
        for (const session of sessions) {
          await storage.deleteWhatsappSession(session.id);
        }
      }

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
      const total = await storage.getContactCount(search, companyId);
      
      res.json({
        contacts: contacts,
        total: total
      });
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

  // Contact import routes
  app.get("/api/contacts/tags", isAuthenticated, async (req, res) => {
    try {
      const tags = await storage.getAvailableTags();
      res.json(tags);
    } catch (error) {
      console.error("Error getting available tags:", error);
      res.json([]);
    }
  });

  app.get("/api/contacts/import-template", isAuthenticated, async (req, res) => {
    try {
      // Create a simple CSV template
      const csvContent = "Nome,Email,Telefone,Cargo,Empresa,Status,Tags\nJoão Silva,joao@exemplo.com,(11) 99999-9999,Gerente,Empresa ABC,ativo,cliente;prospect\nMaria Santos,maria@exemplo.com,(11) 88888-8888,Diretora,Empresa XYZ,ativo,cliente";
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="template_contatos.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: "Failed to generate template" });
    }
  });

  app.post("/api/contacts/preview-import", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo é obrigatório" });
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname.toLowerCase();
      
      console.log('Preview import - File:', fileName, 'Size:', fileBuffer.length);

      let data: any[] = [];
      
      if (fileName.endsWith('.csv')) {
        // Parse CSV
        const csvText = fileBuffer.toString('utf-8');
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          return res.status(400).json({ message: "Arquivo CSV está vazio" });
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        return res.json({
          columns: headers,
          totalRows: lines.length - 1
        });
        
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileBuffer);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (data.length === 0) {
            return res.status(400).json({ message: "Planilha está vazia" });
          }

          const headers = data[0] || [];
          
          return res.json({
            columns: headers,
            totalRows: data.length - 1
          });
          
        } catch (excelError) {
          console.error('Excel parsing error:', excelError);
          return res.status(400).json({ message: "Erro ao processar arquivo Excel. Verifique se o arquivo não está corrompido." });
        }
      } else {
        return res.status(400).json({ message: "Formato de arquivo não suportado. Use .xlsx, .xls ou .csv" });
      }

    } catch (error) {
      console.error("Error previewing import:", error);
      res.status(500).json({ message: "Erro ao analisar arquivo" });
    }
  });

  app.post("/api/contacts/import", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo é obrigatório" });
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname.toLowerCase();
      const fieldMapping = req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : {};
      const pipelineId = req.body.pipelineId ? parseInt(req.body.pipelineId) : undefined;
      const tags = req.body.tags ? JSON.parse(req.body.tags) : [];

      console.log('Import - File:', fileName, 'Mapping:', fieldMapping);

      let data: any[] = [];
      
      if (fileName.endsWith('.csv')) {
        // Parse CSV
        const csvText = fileBuffer.toString('utf-8');
        const lines = csvText.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          return res.status(400).json({ message: "Arquivo CSV deve conter pelo menos cabeçalho e uma linha de dados" });
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
        
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel
        try {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(fileBuffer);
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(worksheet);
          
        } catch (excelError) {
          console.error('Excel parsing error:', excelError);
          return res.status(400).json({ message: "Erro ao processar arquivo Excel" });
        }
      } else {
        return res.status(400).json({ message: "Formato de arquivo não suportado" });
      }

      if (data.length === 0) {
        return res.status(400).json({ message: "Nenhum dado encontrado no arquivo" });
      }

      // Import contacts using the mapping
      const result = await storage.createContactsFromImport(data, pipelineId, tags, fieldMapping);
      res.json(result);

    } catch (error) {
      console.error("Error importing contacts:", error);
      res.status(500).json({ message: "Erro na importação" });
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
      // Convert expectedCloseDate from ISO string to Date if present
      const dealData = {
        ...req.body,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null
      };
      
      const deal = await storage.createDeal(dealData);
      res.json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  app.put("/api/deals/:id", isAuthenticated, async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      // Convert expectedCloseDate from ISO string to Date if present
      const dealData = {
        ...req.body,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null
      };
      
      const deal = await storage.updateDeal(dealId, dealData);
      res.json(deal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ message: "Failed to update deal" });
    }
  });

  app.get("/api/deals/by-stage", isAuthenticated, async (req, res) => {
    try {
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      
      console.log('Getting deals by stage for pipeline:', pipelineId);
      
      const dealsByStage = await storage.getDealsByStage(pipelineId);
      
      console.log('Deals by stage result:', dealsByStage);
      
      res.json(dealsByStage);
    } catch (error) {
      console.error("Error getting deals by stage:", error);
      res.status(500).json({ message: "Failed to get deals by stage" });
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