import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-minimal";
import { requireUser } from "./supabaseAuth";

import { webSocketManager } from "./websocket";
import whatsappRoutes from "./routes/whatsapp.routes";
import multer from "multer";

const upload = multer();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup WebSocket server
  webSocketManager.setup(httpServer);

  // Setup authentication first
  await 

  // Basic routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // WhatsApp Z-API routes
  app.use("/api/whatsapp", whatsappRoutes);

  // Company routes
  app.get("/api/companies", requireUser, async (req, res) => {
    try {
      const search = req.query.search as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const companies = await storage.getCompanies(search, limit, offset);
      res.json(companies);
    } catch (error) {
      console.error("Error getting companies:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get companies" });
    }
  });

  app.post("/api/companies", requireUser, async (req, res) => {
    try {
      const company = await storage.createCompany(req.body);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create company" });
    }
  });

  app.put("/api/companies/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      const companyData = req.body;
      const updatedCompany = await storage.updateCompany(id, companyData);
      if (!updatedCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(updatedCompany);
    } catch (error) {
      console.error(`Error updating company ${req.params.id}:`, error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      await storage.deleteCompany(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting company ${req.params.id}:`, error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete company" });
    }
  });

  // Contact routes
  app.get("/api/contacts", requireUser, async (req, res) => {
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
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get contacts" });
    }
  });

  app.post("/api/contacts", requireUser, async (req, res) => {
    try {
      const contact = await storage.createContact(req.body);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create contact" });
    }
  });

  app.put("/api/contacts/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }
      const contactData = req.body;
      const updatedContact = await storage.updateContact(id, contactData);
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(updatedContact);
    } catch (error) {
      console.error(`Error updating contact ${req.params.id}:`, error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update contact" });
    }
  });

  // Contact import routes

  // DELETE /api/contacts/:id
  app.delete("/api/contacts/:id", requireUser, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      await storage.deleteContact(contactId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete contact" });
    }
  });
  app.get("/api/contacts/tags", requireUser, async (req, res) => {
    try {
      const tags = await storage.getAvailableTags();
      res.json(tags);
    } catch (error) {
      console.error("Error getting available tags:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get tags" });
    }
  });

  app.get("/api/contacts/import-template", requireUser, async (req, res) => {
    try {
      // Create a simple CSV template
      const csvContent = "Nome,Email,Telefone,Cargo,Empresa,Status,Tags\nJoão Silva,joao@exemplo.com,(11) 99999-9999,Gerente,Empresa ABC,ativo,cliente;prospect\nMaria Santos,maria@exemplo.com,(11) 88888-8888,Diretora,Empresa XYZ,ativo,cliente";
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="template_contatos.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating template:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to generate template" });
    }
  });

  app.post("/api/contacts/preview-import", requireUser, upload.single('file'), async (req, res) => {
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
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro ao analisar arquivo" });
    }
  });

  app.post("/api/contacts/import", requireUser, upload.single('file'), async (req, res) => {
    try {
      // Allow simple JSON array payload (no file upload) for automated tests
      if (!req.file) {
        if (Array.isArray(req.body) && req.body.length > 0) {
          try {
            const createdContacts: any[] = [];
            for (const item of req.body as any[]) {
              const contact = await storage.createContact({
                name: item.name,
                email: item.email,
                phone: item.phone,
              });
              createdContacts.push(contact);
            }
            return res.status(201).json({ imported: createdContacts.length, contacts: createdContacts });
          } catch (bulkErr) {
            console.error("JSON import error:", bulkErr);
            return res.status(500).json({ message: "Failed to import contacts" });
          }
        }
        return res.status(400).json({ message: "Arquivo é obrigatório ou payload inválido" });
      }

      // File upload branch
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
      res.status(201).json(result);

    } catch (error) {
      console.error("Error importing contacts:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Erro na importação" });
    }
  });

  // Deal routes
  app.get("/api/deals", requireUser, async (req, res) => {
    try {
      const stage = req.query.stage as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;

      const deals = await storage.getDeals(stage, limit, offset, contactId);
      res.json(deals);
    } catch (error) {
      console.error("Error getting deals:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get deals" });
    }
  });

  app.post("/api/deals", requireUser, async (req, res) => {
    try {
      // Convert expectedCloseDate from ISO string to Date if present
      const dealData = {
        ...req.body,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null
      };
      
      const deal = await storage.createDeal(dealData);
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create deal" });
    }
  });

  app.put("/api/deals/:id", requireUser, async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      // Convert expectedCloseDate from ISO string to Date if present
      const dealData = {
        ...req.body,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null
      };
      
      const deal = await storage.updateDeal(dealId, dealData);
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update deal" });
    }
  });

  app.get("/api/deals/by-stage", requireUser, async (req, res) => {
    try {
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      
      console.log('Getting deals by stage for pipeline:', pipelineId);
      
      const dealsByStage = await storage.getDealsByStage(pipelineId);
      
      console.log('Deals by stage result:', dealsByStage);
      
      res.json(dealsByStage);
    } catch (error) {
      console.error("Error getting deals by stage:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get deals by stage" });
    }
  });

  // Pipeline routes
  app.get("/api/pipelines", requireUser, async (req, res) => {
    try {
      const pipelines = await storage.getPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error getting pipelines:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get pipelines" });
    }
  });

  // POST /api/pipelines
  app.post("/api/pipelines", requireUser, async (req, res) => {
    try {
      const pipeline = await storage.createPipeline(req.body);
      res.status(201).json(pipeline);
    } catch (error) {
      console.error("Error creating pipeline:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create pipeline" });
    }
  });

  app.put("/api/pipelines/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid pipeline ID" });
      }
      const pipelineData = req.body;
      const updatedPipeline = await storage.updatePipeline(id, pipelineData);
      if (!updatedPipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      res.json(updatedPipeline);
    } catch (error) {
      console.error(`Error updating pipeline ${req.params.id}:`, error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update pipeline" });
    }
  });

  app.delete("/api/pipelines/:id", requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid pipeline ID" });
      }
      await storage.deletePipeline(id);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting pipeline ${req.params.id}:`, error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete pipeline" });
    }
  });

  app.get("/api/pipeline-stages", requireUser, async (req, res) => {
    try {
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      const stages = await storage.getPipelineStages(pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Error getting pipeline stages:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get pipeline stages" });
    }
  });

  // Update positions of multiple pipeline stages
  app.put("/api/pipeline-stages/positions", requireUser, async (req, res) => {
    try {
      const { stages } = req.body;

      if (!Array.isArray(stages) || stages.length === 0) {
        return res.status(400).json({ message: 'Invalid input: stages must be a non-empty array' });
      }

      // Basic validation for each stage object
      for (const stage of stages) {
        if (typeof stage.id !== 'number' || typeof stage.position !== 'number') {
          return res.status(400).json({ message: 'Invalid input: each stage must have a numeric id and position' });
        }
      }

      await storage.updateStagePositions(stages);
      res.status(200).json({ message: 'Stage positions updated successfully' });
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error updating stage positions:', error.message);
        res.status(500).json({ message: 'Failed to update stage positions', error: error.message });
      } else {
        console.error('An unknown error occurred while updating stage positions');
        res.status(500).json({ message: 'An unknown error occurred' });
      }
    }
  });

  // Nested route: POST /api/pipelines/:pipelineId/stages
  app.post("/api/pipelines/:pipelineId/stages", requireUser, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.pipelineId);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ message: "Invalid pipelineId" });
      }

      const { name, title, order, position, color } = req.body as any;
      const stageData: any = {
        title: title ?? name,
        position: position ?? order,
        color: color ?? "#3b82f6",
        pipelineId,
      };
      const stage = await storage.createPipelineStage(stageData);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating pipeline stage:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create pipeline stage" });
    }
  });

  // GET /api/pipelines/:pipelineId/stages
  app.get("/api/pipelines/:pipelineId/stages", requireUser, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.pipelineId);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ message: "Invalid pipelineId" });
      }
      const stages = await storage.getPipelineStages(pipelineId);
      res.json(stages);
    } catch (error) {
      console.error(`Error getting stages for pipeline ${req.params.pipelineId}:`, error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get pipeline stages" });
    }
  });

  // Nested route: POST /api/pipelines/:pipelineId/deals
  app.post("/api/pipelines/:pipelineId/deals", requireUser, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.pipelineId);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ message: "Invalid pipelineId" });
      }

      // Map stageId (numeric) to stage string if provided
      let stage = req.body.stage ?? undefined;
      const stageId = req.body.stageId ? Number(req.body.stageId) : undefined;
      if (!stage && stageId) {
        const stages = await storage.getPipelineStages(pipelineId);
        const stageRecord = stages.find((s: any) => s.id === stageId);
        if (!stageRecord) {
          return res.status(400).json({ message: "Invalid stageId" });
        }
        stage = stageRecord.title;
      }

      const dealData = {
        title: (req.body.name ?? req.body.title ?? '').toString().trim() || 'Novo Negócio',
        value: req.body.value ? Number(req.body.value).toString() : null,
        pipelineId,
        stage: stage ?? 'prospecting',
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null,
        contactId: req.body.contactId ?? null,
        companyId: req.body.companyId ?? null,
        ownerId: req.body.ownerId ?? null,
        description: req.body.description ?? null,
      };
      console.log('Deal data:', dealData);

      const deal = await storage.createDeal(dealData);
      return res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      return res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create deal" });
    }
  });

  // PATCH /api/pipelines/:pipelineId/stages/:stageId
  app.patch("/api/pipelines/:pipelineId/stages/:stageId", requireUser, async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.pipelineId);
      const stageId = parseInt(req.params.stageId);
      if (isNaN(pipelineId) || isNaN(stageId)) {
        return res.status(400).json({ message: "Invalid pipelineId or stageId" });
      }

      const { name, title, order, position, color } = req.body as any;
      const stageData: any = {
        ...(title || name ? { title: title ?? name } : {}),
        ...(position || order ? { position: position ?? order } : {}),
        ...(color ? { color } : {}),
      };

      const updated = await storage.updatePipelineStage(stageId, stageData);
      res.status(200).json(updated);
    } catch (error) {
      console.error("Error updating pipeline stage:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update pipeline stage" });
    }
  });

  // DELETE /api/pipelines/:pipelineId/stages/:stageId
  app.delete("/api/pipelines/:pipelineId/stages/:stageId", requireUser, async (req, res) => {
    try {
      const stageId = parseInt(req.params.stageId);
      if (isNaN(stageId)) {
        return res.status(400).json({ message: "Invalid stageId" });
      }
      await storage.deletePipelineStage(stageId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pipeline stage:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete pipeline stage" });
    }
  });

  // POST /api/pipeline-stages
  app.post("/api/pipeline-stages", requireUser, async (req, res) => {
    try {
      const stage = await storage.createPipelineStage(req.body);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating pipeline stage:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create pipeline stage" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/metrics", requireUser, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting dashboard metrics:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to get dashboard metrics" });
    }
  });

  // Auth setup
  

  return httpServer;
}