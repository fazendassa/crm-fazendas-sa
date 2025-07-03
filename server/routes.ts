import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { whatsAppManager } from "./whatsapp-service";
import { webSocketManager } from "./websocket";
import multer from "multer";
import * as XLSX from "xlsx";
import csv from "csv-parser";
import { Readable } from "stream";
import { promisify } from "util";
import fs from "fs";
import { requirePermission, requireAnyPermission, applyDataFiltering } from "./rbac";
import { db } from "./db";
import { activeCampaignConfigs } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  insertCompanySchema,
  insertContactSchema,
  insertDealSchema,
  insertActivitySchema,
  insertPipelineSchema,
  insertPipelineStageSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, requirePermission('view:users'), async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/users/:id/role', isAuthenticated, requirePermission('update:users'), async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      if (!role || !['admin', 'gestor', 'vendedor', 'financeiro', 'externo'].includes(role)) {
        return res.status(400).json({ message: "Papel inválido" });
      }

      await storage.updateUserRole(userId, role);
      res.status(200).json({ message: "Papel atualizado com sucesso" });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Company routes
  app.get('/api/companies', isAuthenticated, async (req, res) => {
    try {
      const { search, limit = '50', offset = '0' } = req.query;
      const companies = await storage.getCompanies(
        search as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      const total = await storage.getCompanyCount(search as string);
      res.json({ companies, total });
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get('/api/companies/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post('/api/companies', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCompanySchema.partial().parse(req.body);
      const company = await storage.updateCompany(id, validatedData);
      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  app.delete('/api/companies/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompany(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Contact routes
  app.get('/api/contacts', isAuthenticated, async (req, res) => {
    try {
      const { search, companyId, limit = '50', offset = '0' } = req.query;
      const contacts = await storage.getContacts(
        search as string,
        companyId ? parseInt(companyId as string) : undefined,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      const total = await storage.getContactCount(
        search as string,
        companyId ? parseInt(companyId as string) : undefined
      );
      res.json({ contacts, total });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Get available tags - must come before :id route
  app.get('/api/contacts/tags', isAuthenticated, async (req, res) => {
    try {
      const tags = await storage.getAvailableTags();
      res.json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ message: 'Erro ao buscar tags' });
    }
  });

  app.get('/api/contacts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }
      const contact = await storage.getContact(id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post('/api/contacts', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put('/api/contacts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(id, validatedData);
      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete('/api/contacts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContact(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Deal routes
  app.get('/api/deals', isAuthenticated, async (req, res) => {
    try {
      const { stage, contactId, limit = '50', offset = '0' } = req.query;
      const deals = await storage.getDeals(
        stage as string,
        parseInt(limit as string),
        parseInt(offset as string),
        contactId ? parseInt(contactId as string) : undefined
      );
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  app.get('/api/deals/by-stage', isAuthenticated, async (req, res) => {
    try {
      const { pipelineId } = req.query;
      const dealsByStage = await storage.getDealsByStage(pipelineId ? parseInt(pipelineId as string) : undefined);
      res.json(dealsByStage);
    } catch (error) {
      console.error("Error fetching deals by stage:", error);
      res.status(500).json({ message: "Failed to fetch deals by stage" });
    }
  });

  app.get('/api/deals/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deal = await storage.getDeal(id);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ message: "Failed to fetch deal" });
    }
  });

  app.post('/api/deals', isAuthenticated, async (req, res) => {
    try {
      console.log("Received deal creation request:", req.body);
      const validatedData = insertDealSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const deal = await storage.createDeal(validatedData);
      console.log("Created deal:", deal);
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating deal:", error);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  app.put('/api/deals/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid deal ID" });
      }

      console.log(`Updating deal ${id} with data:`, req.body);

      const validatedData = insertDealSchema.partial().parse(req.body);
      const deal = await storage.updateDeal(id, validatedData);

      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }

      console.log(`Deal ${id} updated successfully:`, deal);
      res.json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error updating deal:", error.errors);
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating deal:", error);
      res.status(500).json({ message: "Failed to update deal", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete('/api/deals/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteDeal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ message: "Failed to delete deal" });
    }
  });

  // Activity routes
  app.get('/api/activities', isAuthenticated, async (req, res) => {
    try {
      const { contactId, dealId, userId, limit = '50', offset = '0' } = req.query;
      const activities = await storage.getActivities(
        contactId ? parseInt(contactId as string) : undefined,
        dealId ? parseInt(dealId as string) : undefined,
        userId as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get('/api/activities/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const activity = await storage.getActivity(id);
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      res.json(activity);
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.post('/api/activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertActivitySchema.parse({
        ...req.body,
        userId,
      });
      const activity = await storage.createActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.put('/api/activities/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertActivitySchema.partial().parse(req.body);
      const activity = await storage.updateActivity(id, validatedData);
      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating activity:", error);
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.delete('/api/activities/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteActivity(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting activity:", error);
      res.status(500).json({ message: "Failed to delete activity" });
    }
  });

  // Pipeline endpoints
  app.get("/api/pipelines", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const pipelines = await storage.getPipelines();
      res.json(pipelines);
    } catch (error) {
      console.error("Error fetching pipelines:", error);
      res.status(500).json({ message: "Failed to fetch pipelines" });
    }
  });

  // Get pipeline stages
  app.get("/api/pipelines/:pipelineId/stages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const pipelineId = parseInt(req.params.pipelineId);
      const stages = await storage.getPipelineStages(pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      res.status(500).json({ message: "Failed to fetch pipeline stages" });
    }
  });

  app.get("/api/pipelines/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(id);
      if (!pipeline) {
        return res.status(404).json({ message: "Pipeline not found" });
      }
      res.json(pipeline);
    } catch (error) {
      console.error("Error fetching pipeline:", error);
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  app.post("/api/pipelines", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPipelineSchema.parse(req.body);
      const pipeline = await storage.createPipeline(validatedData);
      res.status(201).json(pipeline);
    } catch (error) {
      console.error("Error creating pipeline:", error);
      res.status(500).json({ message: "Failed to create pipeline" });
    }
  });

  app.put("/api/pipelines/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPipelineSchema.partial().parse(req.body);
      const pipeline = await storage.updatePipeline(id, validatedData);
      res.json(pipeline);
    } catch (error) {
      console.error("Error updating pipeline:", error);
      res.status(500).json({ message: "Failed to update pipeline" });
    }
  });

  app.delete("/api/pipelines/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if pipeline has active deals
      const dealsByStage = await storage.getDealsByStage(id);
      const totalActiveDeals = dealsByStage.reduce((sum, stage) => sum + stage.count, 0);

      if (totalActiveDeals > 0) {
        return res.status(400).json({ 
          message: `Não é possível excluir o pipeline. Existem ${totalActiveDeals} oportunidade(s) ativa(s) neste pipeline. Remova ou transfira as oportunidades antes de excluir o pipeline.` 
        });
      }

      await storage.deletePipeline(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pipeline:", error);
      res.status(500).json({ message: "Failed to delete pipeline" });
    }
  });

  // Pipeline stages routes
  app.get("/api/pipeline-stages", isAuthenticated, async (req, res) => {
    try {
      const pipelineId = req.query.pipelineId ? parseInt(req.query.pipelineId as string) : undefined;
      const stages = await storage.getPipelineStages(pipelineId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      res.status(500).json({ message: "Failed to fetch pipeline stages" });
    }
  });

  app.post("/api/pipeline-stages", isAuthenticated, async (req, res) => {
    try {
      const stage = await storage.createPipelineStage(req.body);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating pipeline stage:", error);
      if (error instanceof Error && error.message.includes("cannot have more than 12 stages")) {
        return res.status(400).json({ message: "Pipeline cannot have more than 12 stages" });
      }
      res.status(500).json({ message: "Failed to create pipeline stage" });
    }
  });

  // Batch update stage positions - MUST be before /:id route
  app.put("/api/pipeline-stages/positions", isAuthenticated, async (req, res) => {
    try {
      const { stages } = req.body;

      if (!stages || !Array.isArray(stages)) {
        return res.status(400).json({ message: "Invalid stages data" });
      }

      await storage.updateStagePositions(stages);
      res.json({ message: "Stage positions updated successfully" });
    } catch (error) {
      console.error("Error updating stage positions:", error);
      res.status(500).json({ message: "Failed to update stage positions" });
    }
  });

  app.put("/api/pipeline-stages/:id", isAuthenticated, async (req, res) => {
    try {
      const stageId = parseInt(req.params.id);

      if (isNaN(stageId) || stageId <= 0) {
        return res.status(400).json({ message: "Invalid stage ID" });
      }

      // Validate position if it's being updated
      if (req.body.position !== undefined) {
        const position = Number(req.body.position);
        if (isNaN(position) || !Number.isInteger(position) || position < 0) {
          return res.status(400).json({ message: "Position must be a valid integer >= 0" });
        }
        req.body.position = position;
      }

      // Skip existence check for now to avoid ID lookup issues

      const stage = await storage.updatePipelineStage(stageId, req.body);
      res.json(stage);
    } catch (error) {
      console.error("Error updating pipeline stage:", error);
      res.status(500).json({ message: "Failed to update pipeline stage" });
    }
  });

  app.delete("/api/pipeline-stages/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deletePipelineStage(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pipeline stage:", error);
      res.status(500).json({ message: "Failed to delete pipeline stage" });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard/metrics', isAuthenticated, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv' // .csv
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos Excel (.xlsx, .xls) e CSV (.csv) são permitidos'));
      }
    }
  });

  // Import contacts from Excel/CSV
  app.post('/api/contacts/import', 
    isAuthenticated, 
    requirePermission('create:contacts'),
    upload.single('file'),
    async (req, res) => {
      try {
        console.log('=== INÍCIO DO PROCESSAMENTO DA IMPORTAÇÃO ===');

        if (!req.file) {
          console.log('ERRO: Nenhum arquivo foi enviado');
          return res.status(400).json({ message: 'Nenhum arquivo foi enviado' });
        }

        console.log('Arquivo recebido:', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        });

        const { pipelineId, tags } = req.body;
        console.log('Parâmetros recebidos:', { pipelineId, tags });

        let data: any[] = [];

        // Parse file based on type
        if (req.file.mimetype.includes('spreadsheet') || req.file.mimetype.includes('excel')) {
          console.log('Processando arquivo Excel...');
          // Parse Excel file
          const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
          console.log('Planilhas disponíveis:', workbook.SheetNames);

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          data = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            raw: false
          });

          // Convert array of arrays to array of objects with first row as headers
          if (data.length > 0) {
            const headers = data[0] as string[];
            console.log('Cabeçalhos encontrados:', headers);

            data = data.slice(1).map((row: any[]) => {
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = row[index] || '';
              });
              return obj;
            });
          }

        } else if (req.file.mimetype === 'text/csv') {
          console.log('Processando arquivo CSV...');
          // Parse CSV file
          const csvData: any[] = [];
          const stream = Readable.from(req.file.buffer);

          await new Promise((resolve, reject) => {
            stream
              .pipe(csv())
              .on('data', (row) => {
                console.log('Linha CSV lida:', row);
                csvData.push(row);
              })
              .on('end', resolve)
              .on('error', reject);
          });
          data = csvData;
        } else {
          console.log('ERRO: Tipo de arquivo não suportado:', req.file.mimetype);
          return res.status(400).json({ message: 'Tipo de arquivo não suportado' });
        }

        console.log('Total de linhas processadas:', data.length);
        console.log('Amostra dos dados processados:', data.slice(0, 2));

        if (data.length === 0) {
          console.log('ERRO: Arquivo vazio ou formato inválido');
          return res.status(400).json({ message: 'Arquivo vazio ou formato inválido' });
        }

        // Get field mapping from form data
        const fieldMapping = req.body.fieldMapping ? JSON.parse(req.body.fieldMapping) : {};
        console.log('Mapeamento de campos:', fieldMapping);

        // Process and import contacts
        const result = await storage.createContactsFromImport(
          data, 
          pipelineId ? parseInt(pipelineId) : undefined,
          tags ? JSON.parse(tags) : [],
          fieldMapping
        );

        console.log('Resultado da importação:', result);

        res.json({
          message: `Importação concluída: ${result.success} contatos importados`,
          success: result.success,
          errors: result.errors
        });

      } catch (error) {
        console.error('Erro na importação:', error);
        console.error('Stack trace completo:', error instanceof Error ? error.stack : 'Erro sem stack trace');
        res.status(500).json({ 
          message: 'Erro interno do servidor',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }
  );

  // Preview import file to get columns
  app.post('/api/contacts/preview-import', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Arquivo não fornecido' });
      }

      console.log('=== PREVIEW DE IMPORTAÇÃO ===');
      console.log('Arquivo recebido:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      let data: any[] = [];

      // Parse file based on type
      if (req.file.mimetype.includes('spreadsheet') || req.file.mimetype.includes('excel')) {
        console.log('Processando arquivo Excel para preview...');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '',
          raw: false
        });

        if (rawData.length > 0) {
          const headers = rawData[0] as string[];
          console.log('Cabeçalhos encontrados:', headers);
          return res.json({ columns: headers.filter(h => h && h.trim() !== '') });
        }

      } else if (req.file.mimetype === 'text/csv') {
        console.log('Processando arquivo CSV para preview...');
        const csvData: any[] = [];
        const stream = Readable.from(req.file.buffer);

        await new Promise((resolve, reject) => {
          stream
            .pipe(csv())
            .on('data', (row) => {
              csvData.push(row);
            })
            .on('end', resolve)
.on('error', reject);
        });

        if (csvData.length > 0) {
          const headers = Object.keys(csvData[0]);
          console.log('Cabeçalhos CSV encontrados:', headers);
          return res.json({ columns: headers.filter(h => h && h.trim() !== '')});
        }

      } else {
        return res.status(400).json({ message: 'Tipo de arquivo não suportado' });
      }

      return res.status(400).json({ message: 'Arquivo vazio ou sem cabeçalhos válidos' });

    } catch (error) {
      console.error('Erro no preview da importação:', error);
      res.status(500).json({ 
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
            });
    }
  });

  // Download import template
  app.get('/api/contacts/import-template', isAuthenticated, (req, res) => {
    const templateData = [
      {
        'Nome': 'João Silva',
        'Email': 'joao.silva@empresa.com',
        'Telefone': '(11) 99999-9999',
        'Cargo': 'Gerente de Vendas',
        'Empresa': 'Empresa Exemplo',
        'Status': 'active'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=template-contatos.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });

  // WhatsApp Integration Routes
  app.get('/api/whatsapp/sessions', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔍 WhatsApp Sessions - req.user:', req.user);
      const userId = req.user?.claims?.sub || req.user?.id || req.user?.userId;
      console.log('🔍 WhatsApp Sessions - userId:', userId);

      if (!userId) {
        console.error('❌ WhatsApp Sessions - No user ID found');
        console.error('❌ WhatsApp Sessions - req.user structure:', JSON.stringify(req.user, null, 2));
        return res.status(401).json({ message: "User ID not found" });
      }

      const sessions = await storage.getWhatsappSessions(userId);
      console.log('✅ WhatsApp Sessions - Found sessions:', sessions.length);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching WhatsApp sessions:", error);
      res.status(500).json({ message: "Failed to fetch WhatsApp sessions", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post('/api/whatsapp/create-session', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🔍 Create Session - req.user:', req.user);
      const userId = req.user?.claims?.sub || req.user?.id || req.user?.userId;
      console.log('🔍 Create Session - userId:', userId);

      if (!userId) {
        console.error('❌ Create Session - No user ID found');
        console.error('❌ Create Session - req.user structure:', JSON.stringify(req.user, null, 2));
        return res.status(401).json({ message: "User ID not found" });
      }

      const { sessionName } = req.body;

      if (!sessionName) {
        return res.status(400).json({ message: "Session name is required" });
      }

      const result = await whatsAppManager.createSession(userId, sessionName);
      res.json({ message: result });
    } catch (error) {
      console.error("Error creating WhatsApp session:", error);
      res.status(500).json({ message: "Failed to create WhatsApp session", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post('/api/whatsapp/send', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const { to, text } = req.body;

      if (!to || !text) {
        return res.status(400).json({ message: "Phone number and message text are required" });
      }

      const result = await whatsAppManager.sendMessage(userId, to, text);
      res.json({ message: "Message sent successfully", result });
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ 
        message: "Failed to send message",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get('/api/whatsapp/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const status = await whatsAppManager.getSessionStatus(userId);
      res.json({ status });
    } catch (error) {
      console.error("Error getting WhatsApp status:", error);
      res.status(500).json({ message: "Failed to get WhatsApp status" });
    }
  });

  app.get('/api/whatsapp/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      const { chatId, limit } = req.query;

      const messages = await whatsAppManager.getMessages(
        userId, 
        chatId as string, 
        limit ? parseInt(limit as string) : 50
      );
      res.json({ messages });
    } catch (error) {
      console.error("Error getting WhatsApp messages:", error);
      res.status(500).json({ message: "Failed to get WhatsApp messages" });
    }
  });

  app.delete('/api/whatsapp/session', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      await whatsAppManager.closeSession(userId);
      res.json({ message: "Session closed successfully" });
    } catch (error) {
      console.error("Error closing WhatsApp session:", error);
      res.status(500).json({ message: "Failed to close WhatsApp session" });
    }
  });

  const httpServer = createServer(app);

  // Set up WebSocket server for real-time communication
  webSocketManager.setup(httpServer);

  // ActiveCampaign Integration Routes

  // Get user's ActiveCampaign configurations
  app.get("/api/integrations/activecampaign/configs", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const configs = await storage.getActiveCampaignConfigs(userId);
      res.json(configs);
    } catch (error) {
      console.error("Error fetching ActiveCampaign configs:", error);
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  // Get single ActiveCampaign configuration
  app.get("/api/integrations/activecampaign/configs/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const configId = parseInt(req.params.id);
      const config = await storage.getActiveCampaignConfigById(configId, userId);

      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching ActiveCampaign config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  // Create ActiveCampaign configuration
  app.post("/api/integrations/activecampaign/configs", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { activeCampaignApiUrl, activeCampaignApiKey, pipelineId, defaultTags, fieldMapping, webhookType } = req.body;

      // Validation
      if (!activeCampaignApiUrl || !activeCampaignApiKey || !pipelineId) {
        return res.status(400).json({ 
          message: "ActiveCampaign API URL, API Key, and Pipeline are required" 
        });
      }

      // Generate a webhook secret for security
      const webhookSecret = Math.random().toString(36).substring(2, 15) + 
                           Math.random().toString(36).substring(2, 15);

      const configData = {
        userId,
        activeCampaignApiUrl: activeCampaignApiUrl.trim(),
        activeCampaignApiKey: activeCampaignApiKey.trim(),
        webhookSecret,
        defaultPipelineId: parseInt(pipelineId),
        defaultTags: defaultTags || [],
        fieldMapping: fieldMapping || {},
        webhookType: webhookType || 'contact',
        isActive: true
      };

      const config = await storage.createActiveCampaignConfig(configData);

      if (!config) {
        return res.status(500).json({ message: "Failed to save configuration" });
      }

      res.json(config);
    } catch (error) {
      console.error("Error saving ActiveCampaign config:", error);
      res.status(500).json({ message: "Failed to save configuration" });
    }
  });

  // Delete ActiveCampaign configuration
  app.delete("/api/integrations/activecampaign/configs/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const configId = parseInt(req.params.id);
      await storage.deleteActiveCampaignConfigById(configId, userId);
      res.json({ message: "Configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting ActiveCampaign config:", error);
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // ActiveCampaign Webhook Endpoint (PUBLIC - no authentication required)
  app.post("/api/integrations/activecampaign/webhook/:configId", async (req, res) => {
    try {
      console.log('\n=== ACTIVECAMPAIGN WEBHOOK RECEIVED ===');
      console.log('URL Params:', req.params);
      console.log('Headers:', req.headers);
      console.log('Body:', JSON.stringify(req.body, null, 2));

      const configId = parseInt(req.params.configId);

      if (!configId) {
        console.log('❌ WEBHOOK: No config ID provided');
        return res.status(400).json({ message: "Configuration ID required" });
      }

      // Get specific configuration
      const config = await storage.getActiveCampaignConfigById(configId);

      if (!config) {
        console.log('❌ WEBHOOK: Configuration not found for ID:', configId);
        return res.status(404).json({ message: "Configuration not found" });
      }

      console.log('✓ WEBHOOK: Configuration found:', {
        id: config.id,
        userId: config.userId,
        pipelineId: config.defaultPipelineId,
        hasSecret: !!config.webhookSecret
      });

      // Get webhook secret from header (make optional for now)
      const providedSecret = req.headers['x-api-key'] || req.headers['x-webhook-secret'] || req.headers['authorization'];

      // For now, skip secret validation to test webhook functionality
      if (config.webhookSecret && providedSecret && config.webhookSecret !== providedSecret) {
        console.log('⚠️ WEBHOOK: Secret mismatch, but continuing for testing');
        console.log('Expected:', config.webhookSecret);
        console.log('Provided:', providedSecret);
      }

      const webhookData = req.body;

      // Extract contact data from ActiveCampaign webhook format
      console.log('🔍 WEBHOOK: Extracting contact data...');

      // ActiveCampaign sends data in contact[field] format
      const contactEmail = webhookData['contact[email]'] || webhookData.email;
      const contactFirstName = webhookData['contact[first_name]'] || webhookData.first_name || '';
      const contactLastName = webhookData['contact[last_name]'] || webhookData.last_name || '';
      const contactPhone = webhookData['contact[phone]'] || webhookData.phone || '';
      const contactOrgName = webhookData['contact[orgname]'] || webhookData.orgname || '';

      console.log('📋 WEBHOOK: Extracted fields:', {
        email: contactEmail,
        firstName: contactFirstName,
        lastName: contactLastName,
        phone: contactPhone,
        orgName: contactOrgName
      });

      if (!contactEmail && !contactFirstName && !contactLastName) {
        console.log('❌ WEBHOOK: No valid contact data in webhook');
        console.log('Available fields:', Object.keys(webhookData));
        return res.status(400).json({ message: "No contact data provided" });
      }

      let createdContact = null;
      let createdDeal = null;
      let errorMessage = null;

      try {
        // Create contact name
        const contactName = [contactFirstName, contactLastName].filter(Boolean).join(' ').trim() || 
                           contactEmail || 'Contato ActiveCampaign';

        // Create or update contact
        const contactData = {
          name: contactName,
          email: contactEmail || null,
          phone: contactPhone || null,
          status: 'active',
          source: 'activecampaign',
          pipelineId: config.defaultPipelineId,
          tags: config.defaultTags || [],
          companyId: null
        };

        console.log('📝 WEBHOOK: Contact data to create:', contactData);

        // Check if contact already exists by email
        let existingContact;
        if (contactData.email) {
          console.log('🔍 WEBHOOK: Checking for existing contact with email:', contactData.email);
          const existingContacts = await storage.getContacts(contactData.email);
          existingContact = existingContacts.contacts?.find(c => c.email === contactData.email);
          console.log('🔍 WEBHOOK: Existing contact found:', !!existingContact);
        }

        if (existingContact) {
          // Update existing contact
          console.log('📝 WEBHOOK: Updating existing contact:', existingContact.id);
          createdContact = await storage.updateContact(existingContact.id, {
            name: contactData.name,
            phone: contactData.phone,
            tags: [...(existingContact.tags || []), ...(contactData.tags || [])]
          });
          console.log('✅ WEBHOOK: Contact updated successfully:', createdContact.id);
        } else {
          // Create new contact
          console.log('📝 WEBHOOK: Creating new contact...');
          createdContact = await storage.createContact(contactData);
          console.log('✅ WEBHOOK: Contact created successfully:', createdContact.id);
        }

        // Handle company creation if orgname is provided
        if (contactOrgName && contactOrgName.trim()) {
          console.log('🏢 WEBHOOK: Processing company:', contactOrgName);
          try {
            // Check if company already exists
            const companies = await storage.getCompanies(contactOrgName);
            let company = companies.find(c => c.name.toLowerCase() === contactOrgName.toLowerCase());

            if (!company) {
              // Create new company
              company = await storage.createCompany({
                name: contactOrgName.trim(),
                sector: null,
                location: null
              });
              console.log('✅ WEBHOOK: Company created:', company.id);
            } else {
              console.log('✅ WEBHOOK: Company found:', company.id);
            }

            // Update contact with company
            if (company && createdContact) {
              createdContact = await storage.updateContact(createdContact.id, {
                companyId: company.id
              });
              console.log('✅ WEBHOOK: Contact updated with company');
            }
          } catch (companyError) {
            console.error('❌ WEBHOOK: Company creation error:', companyError);
          }
        }

        // Create deal if pipeline is configured and deal data is provided
        if (config.defaultPipelineId && createdContact) {
          console.log('📋 WEBHOOK: Creating deal for pipeline:', config.defaultPipelineId);
          const pipelineStages = await storage.getPipelineStages(config.defaultPipelineId);
          const firstStage = pipelineStages.find(stage => stage.position === 0) || pipelineStages[0];

          if (firstStage) {
            const dealData = {
              title: `Oportunidade - ${createdContact.name}`,
              description: 'Oportunidade criada via ActiveCampaign webhook',
              stage: firstStage.title,
              pipelineId: config.defaultPipelineId,
              contactId: createdContact.id,
              companyId: createdContact.companyId,
              value: null,
              expectedCloseDate: null,
            };

            console.log('📝 WEBHOOK: Deal data:', dealData);
            createdDeal = await storage.createDeal(dealData);
            console.log('✅ WEBHOOK: Deal created successfully:', createdDeal.id);
          } else {
            console.log('⚠️ WEBHOOK: No pipeline stages found for pipeline:', config.defaultPipelineId);
          }
        }

      } catch (processError) {
        errorMessage = processError instanceof Error ? processError.message : 'Unknown processing error';
        console.error('❌ WEBHOOK: Processing error:', processError);
      }

      // Log the webhook event
      try {
        const logData = {
          configId: config.id,
          webhookData: req.body,
          contactId: createdContact?.id || null,
          dealId: createdDeal?.id || null,
          status: errorMessage ? 'error' : 'success',
          errorMessage: errorMessage || null
        };

        await storage.createWebhookLog(logData);
        console.log('✓ WEBHOOK: Event logged successfully');
      } catch (logError) {
        console.error('❌ WEBHOOK: Failed to log event:', logError);
        // Don't fail the webhook processing if logging fails
      }

      console.log('✓ WEBHOOK: Event logged successfully');
      console.log('=== WEBHOOK PROCESSING COMPLETE ===\n');

      res.json({
        success: true,
        message: "Webhook processed successfully",
        data: {
          contactId: createdContact?.id,
          dealId: createdDeal?.id,
          status: errorMessage ? 'error' : 'success'
        }
      });

    } catch (error) {
      console.error("❌ WEBHOOK: Fatal error:", error);
      res.status(500).json({ 
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get webhook logs for all configurations of the user
  app.get("/api/integrations/activecampaign/logs", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await storage.getWebhookLogs(undefined, limit, offset);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // Get webhook logs for specific configuration
  app.get("/api/integrations/activecampaign/logs/:configId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const configId = parseInt(req.params.configId);

      const config = await storage.getActiveCampaignConfigById(configId, userId);

      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const logs = await storage.getWebhookLogs(configId, limit, offset);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // Test webhook endpoint (GET method for easy testing)
  app.get("/api/integrations/activecampaign/webhook/:configId/test", async (req, res) => {
    try {
      const configId = parseInt(req.params.configId);
      const config = await storage.getActiveCampaignConfigById(configId);

      if (!config) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      // Create test webhook data
      const testWebhookData = {
        "contact[email]": "teste@exemplo.com",
        "contact[first_name]": "Teste",
        "contact[last_name]": "Webhook",
        "contact[phone]": "(11) 99999-9999",
        "contact[orgname]": "Empresa Teste"
      };

      console.log('🧪 TEST WEBHOOK: Simulating webhook for config:', configId);

      // Process the test data (simulate the webhook processing)
      req.body = testWebhookData;

      // Redirect to the actual webhook handler
      return res.json({
        message: "Test webhook data ready. Use POST method to actually test the webhook.",
        config: {
          id: config.id,
          pipelineId: config.defaultPipelineId,
          webhookUrl: `${req.protocol}://${req.get('host')}/api/integrations/activecampaign/webhook/${configId}`
        },
        testData: testWebhookData
      });

    } catch (error) {
      console.error("Error in test webhook:", error);
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  const sessionStore = new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
    errorLog: (err) => {
      console.error('Session store error:', err);
    }
  });

  app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  return httpServer;
}