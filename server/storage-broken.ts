import {
  users,
  companies,
  contacts,
  deals,
  activities,
  pipelines,
  pipelineStages,
  activeCampaignConfigs,
  activeCampaignWebhookLogs,
  whatsappSessions,
  whatsappMessages,
  whatsappContacts,
  type User,
  type UpsertUser,
  type Company,
  type InsertCompany,
  type Contact,
  type ContactWithCompany,
  type InsertContact,
  type Deal,
  type DealWithRelations,
  type InsertDeal,
  type Activity,
  type ActivityWithRelations,
  type InsertActivity,
  type Pipeline,
  type InsertPipeline,
  type PipelineStage,
  type InsertPipelineStage,
  type ActiveCampaignConfig,
  type ActiveCampaignWebhookLog,
  type InsertActiveCampaignConfig,
  type InsertActiveCampaignWebhookLog,
  type WhatsappSession,
  type InsertWhatsappSession,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type WhatsappMessageWithRelations,
  type WhatsappContact,
  type InsertWhatsappContact,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, or, count, desc, ne, sql, isNotNull, sum } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<void>;

  // Company operations
  getCompanies(search?: string, limit?: number, offset?: number): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;
  getCompanyCount(search?: string): Promise<number>;

  // Contact operations
  getContacts(search?: string, companyId?: number, limit?: number, offset?: number): Promise<ContactWithCompany[]>;
  getContact(id: number): Promise<ContactWithCompany | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: number): Promise<void>;
  getContactCount(search?: string, companyId?: number): Promise<number>;

  // Contact import operations
  importContacts(contacts: InsertContact[]): Promise<{ success: number; errors: string[] }>;
  getAvailableTags(): Promise<string[]>;
  createContactsFromImport(data: any[], pipelineId?: number, tags?: string[]): Promise<{ success: number; errors: string[] }>;

  // Deal operations
  getDeals(stage?: string, limit?: number, offset?: number, contactId?: number): Promise<DealWithRelations[]>;
  getDeal(id: number): Promise<DealWithRelations | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal>;
  deleteDeal(id: number): Promise<void>;
  getDealsByStage(pipelineId?: number): Promise<{ stage: string; count: number; deals: DealWithRelations[] }[]>;

  // Activity operations
  getActivities(contactId?: number, dealId?: number, userId?: string, limit?: number, offset?: number): Promise<ActivityWithRelations[]>;
  getActivity(id: number): Promise<ActivityWithRelations | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity>;
  deleteActivity(id: number): Promise<void>;

  // Pipeline operations
  getPipelines(): Promise<Pipeline[]>;
  getPipeline(id: number): Promise<Pipeline | undefined>;
  createPipeline(pipeline: InsertPipeline): Promise<Pipeline>;
  updatePipeline(id: number, pipeline: Partial<InsertPipeline>): Promise<Pipeline>;
  deletePipeline(id: number): Promise<void>;

  // Pipeline stages operations
  getPipelineStages(pipelineId?: number): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage>;
  deletePipelineStage(id: number): Promise<void>;
  updateStagePositions(stages: { id: number; posicaoestagio: number }[]): Promise<void>;
  updateStagePositions(stages: Array<{ id: number; position: number }>): Promise<void>;


  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    totalContacts: number;
    activeCompanies: number;
    openDeals: number;
    projectedRevenue: string;
  }>;

  // ActiveCampaign Integration
  getActiveCampaignConfigs(userId: string): Promise<ActiveCampaignConfig[]>;
  getActiveCampaignConfigById(configId: number, userId?: string): Promise<ActiveCampaignConfig | undefined>;
  createActiveCampaignConfig(config: InsertActiveCampaignConfig): Promise<ActiveCampaignConfig>;
  updateActiveCampaignConfig(configId: number, config: Partial<InsertActiveCampaignConfig>): Promise<ActiveCampaignConfig | undefined>;
  deleteActiveCampaignConfigById(configId: number, userId: string): Promise<void>;

  // ActiveCampaign Webhook Logs
  createWebhookLog(log: InsertActiveCampaignWebhookLog): Promise<ActiveCampaignWebhookLog>;
  getWebhookLogs(configId?: number, limit?: number, offset?: number): Promise<ActiveCampaignWebhookLog[]>;

  // WhatsApp Session operations
  getWhatsappSessions(): Promise<WhatsappSession[]>;
  getWhatsappSession(id: number): Promise<WhatsappSession | undefined>;
  createWhatsappSession(session: InsertWhatsappSession): Promise<WhatsappSession>;
  updateWhatsappSession(id: number, session: Partial<InsertWhatsappSession>): Promise<WhatsappSession>;
  deleteWhatsappSession(id: number): Promise<void>;

  // WhatsApp Contact operations
  getWhatsappContacts(sessionId?: number): Promise<WhatsappContact[]>;
  getWhatsappContact(phoneNumber: string): Promise<WhatsappContact | undefined>;
  createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact>;
  updateWhatsappContact(id: number, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact>;

  // WhatsApp Message operations
  getWhatsappMessages(phoneNumber?: string, sessionId?: number, limit?: number, offset?: number): Promise<WhatsappMessageWithRelations[]>;
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  updateWhatsappMessage(id: number, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  // Company operations
  async getCompanies(search?: string, limit = 50, offset = 0): Promise<Company[]> {
    const query = db.select().from(companies);

    if (search) {
      query.where(ilike(companies.name, `%${search}%`));
    }

    return await query.limit(limit).offset(offset).orderBy(desc(companies.createdAt));
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company> {
    const [updatedCompany] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getCompanyCount(search?: string): Promise<number> {
    const query = db.select({ count: count() }).from(companies);

    if (search) {
      query.where(ilike(companies.name, `%${search}%`));
    }

    const [result] = await query;
    return result.count;
  }

  // Contact operations
  async getContacts(search?: string, companyId?: number, limit = 50, offset = 0): Promise<ContactWithCompany[]> {
    const query = db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        position: contacts.position,
        companyId: contacts.companyId,
        tags: contacts.tags,
        status: contacts.status,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          location: companies.location,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
        },
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id));

    const conditions = [];
    if (search && search.trim() !== '') {
      conditions.push(
        sql`(${ilike(contacts.name, `%${search}%`)} OR ${ilike(contacts.email, `%${search}%`)})`
      );
    }
    if (companyId) {
      conditions.push(eq(contacts.companyId, companyId));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return await query.limit(limit).offset(offset).orderBy(desc(contacts.createdAt));
  }

  async getContact(id: number): Promise<ContactWithCompany | undefined> {
    const [contact] = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        position: contacts.position,
        companyId: contacts.companyId,
        tags: contacts.tags,
        status: contacts.status,
        createdAt: contacts.createdAt,
        updatedAt: contacts.updatedAt,
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          location: companies.location,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
        },
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(eq(contacts.id, id));
    return contact;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  async updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact> {
    const [updatedContact] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updatedContact;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getContactCount(search?: string, companyId?: number): Promise<number> {
    const conditions = [];
    if (search) {
      conditions.push(ilike(contacts.name, `%${search}%`));
    }
    if (companyId) {
      conditions.push(eq(contacts.companyId, companyId));
    }

    const query = db.select({ count: count() }).from(contacts);
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const [result] = await query;
    return result.count;
  }

  // Deal operations
  async getDeals(stage?: string, limit: number = 50, offset: number = 0, contactId?: number): Promise<DealWithRelations[]> {
    const query = db
      .select({
        id: deals.id,
        title: deals.title,
        value: deals.value,
        stage: deals.stage,
        pipelineId: deals.pipelineId,
        expectedCloseDate: deals.expectedCloseDate,
        contactId: deals.contactId,
        companyId: deals.companyId,
        description: deals.description,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          position: contacts.position,
          companyId: contacts.companyId,
          tags: contacts.tags,
          status: contacts.status,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          location: companies.location,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
        },
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(companies, eq(deals.companyId, companies.id));

    const conditions = [];
    if (stage) {
      conditions.push(eq(deals.stage, stage));
    }
    if (contactId) {
      conditions.push(eq(deals.contactId, contactId));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return await query.limit(limit).offset(offset).orderBy(desc(deals.createdAt));
  }

  async getDeal(id: number): Promise<DealWithRelations | undefined> {
    const [deal] = await db
      .select({
        id: deals.id,
        title: deals.title,
        value: deals.value,
        stage: deals.stage,
        pipelineId: deals.pipelineId,
        expectedCloseDate: deals.expectedCloseDate,
        contactId: deals.contactId,
        companyId: deals.companyId,
        description: deals.description,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          position: contacts.position,
          companyId: contacts.companyId,
          tags: contacts.tags,
          status: contacts.status,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          location: companies.location,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
        },
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ ...deal, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal;
  }

  async deleteDeal(id: number): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getDealsByStage(pipelineId?: number): Promise<{ stage: string; count: number; deals: DealWithRelations[] }[]> {
    // Get stages from pipeline_stages table if pipelineId is provided
    let stages: string[];
    if (pipelineId) {
      const pipelineStages = await this.getPipelineStages(pipelineId);
      stages = pipelineStages.map(s => s.title);
    } else {
      stages = ['prospecting', 'qualification', 'proposal', 'closing'];
    }

    const result = [];

    for (const stage of stages) {
      let dealsInStage;

      if (pipelineId) {
        dealsInStage = await db
          .select({
            id: deals.id,
            title: deals.title,
            value: deals.value,
            stage: deals.stage,
            pipelineId: deals.pipelineId,
            expectedCloseDate: deals.expectedCloseDate,
            contactId: deals.contactId,
            companyId: deals.companyId,
            ownerId: deals.ownerId,
            description: deals.description,
            createdAt: deals.createdAt,
            updatedAt: deals.updatedAt,
            contact: {
              id: contacts.id,
              name: contacts.name,
              email: contacts.email,
              phone: contacts.phone,
              position: contacts.position,
              companyId: contacts.companyId,
              tags: contacts.tags,
              status: contacts.status,
              createdAt: contacts.createdAt,
              updatedAt: contacts.updatedAt,
            },
            company: {
              id: companies.id,
              name: companies.name,
              sector: companies.sector,
              location: companies.location,
              createdAt: companies.createdAt,
              updatedAt: companies.updatedAt,
            },
          })
          .from(deals)
          .leftJoin(contacts, eq(deals.contactId, contacts.id))
          .leftJoin(companies, eq(deals.companyId, companies.id))
          .where(and(eq(deals.stage, stage), eq(deals.pipelineId, pipelineId)))
          .orderBy(desc(deals.createdAt));
      } else {
        dealsInStage = await db
          .select({
            id: deals.id,
            title: deals.title,
            value: deals.value,
            stage: deals.stage,
            pipelineId: deals.pipelineId,
            expectedCloseDate: deals.expectedCloseDate,
            contactId: deals.contactId,
            companyId: deals.companyId,
            ownerId: deals.ownerId,
            description: deals.description,
            createdAt: deals.createdAt,
            updatedAt: deals.updatedAt,
            contact: {
              id: contacts.id,
              name: contacts.name,
              email: contacts.email,
              phone: contacts.phone,
              position: contacts.position,
              companyId: contacts.companyId,
              tags: contacts.tags,
              status: contacts.status,
              createdAt: contacts.createdAt,
              updatedAt: contacts.updatedAt,
            },
            company: {
              id: companies.id,
              name: companies.name,
              sector: companies.sector,
              location: companies.location,
              createdAt: companies.createdAt,
              updatedAt: companies.updatedAt,
            },
          })
          .from(deals)
          .leftJoin(contacts, eq(deals.contactId, contacts.id))
          .leftJoin(companies, eq(deals.companyId, companies.id))
          .where(eq(deals.stage, stage))
          .orderBy(desc(deals.createdAt));
      }

      result.push({
        stage,
        count: dealsInStage.length,
        deals: dealsInStage as DealWithRelations[],
      });
    }

    return result;
  }

  // Activity operations
  async getActivities(contactId?: number, dealId?: number, userId?: string, limit = 50, offset = 0): Promise<ActivityWithRelations[]> {
    const query = db
      .select({
        id: activities.id,
        type: activities.type,
        title: activities.title,
        description: activities.description,
        contactId: activities.contactId,
        dealId: activities.dealId,
        companyId: activities.companyId,
        userId: activities.userId,
        dueDate: activities.dueDate,
        completed: activities.completed,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          position: contacts.position,
          companyId: contacts.companyId,
          tags: contacts.tags,
          status: contacts.status,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        },
        deal: {
          id: deals.id,
          title: deals.title,
          value: deals.value,
          stage: deals.stage,
          expectedCloseDate: deals.expectedCloseDate,
          contactId: deals.contactId,
          companyId: deals.companyId,
          description: deals.description,
          createdAt: deals.createdAt,
          updatedAt: deals.updatedAt,
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          location: companies.location,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
        },
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(activities)
      .leftJoin(contacts, eq(activities.contactId, contacts.id))
      .leftJoin(deals, eq(activities.dealId, deals.id))
      .leftJoin(companies, eq(activities.companyId, companies.id))
      .leftJoin(users, eq(activities.userId, users.id));

    const conditions = [];
    if (contactId) {
      conditions.push(eq(activities.contactId, contactId));
    }
    if (dealId) {
      conditions.push(eq(activities.dealId, dealId));
    }
    if (userId) {
      conditions.push(eq(activities.userId, userId));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return await query.limit(limit).offset(offset).orderBy(desc(activities.createdAt));
  }

  async getActivity(id: number): Promise<ActivityWithRelations | undefined> {
    const [activity] = await db
      .select({
        id: activities.id,
        type: activities.type,
        title: activities.title,
        description: activities.description,
        contactId: activities.contactId,
        dealId: activities.dealId,
        companyId: activities.companyId,
        userId: activities.userId,
        dueDate: activities.dueDate,
        completed: activities.completed,
        createdAt: activities.createdAt,
        updatedAt: activities.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          position: contacts.position,
          companyId: contacts.companyId,
          tags: contacts.tags,
          status: contacts.status,
          createdAt: contacts.createdAt,
          updatedAt: contacts.updatedAt,
        },
        deal: {
          id: deals.id,
          title: deals.title,
          value: deals.value,
          stage: deals.stage,
          expectedCloseDate: deals.expectedCloseDate,
          contactId: deals.contactId,
          companyId: deals.companyId,
          description: deals.description,
          createdAt: deals.createdAt,
          updatedAt: deals.updatedAt,
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector,
          location: companies.location,
          createdAt: companies.createdAt,
          updatedAt: companies.updatedAt,
        },
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(activities)
      .leftJoin(contacts, eq(activities.contactId, contacts.id))
      .leftJoin(deals, eq(activities.dealId, deals.id))
      .leftJoin(companies, eq(activities.companyId, companies.id))
      .leftJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.id, id));
    return activity;
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity> {
    const [updatedActivity] = await db
      .update(activities)
      .set({ ...activity, updatedAt: new Date() })
      .where(eq(activities.id, id))
      .returning();
    return updatedActivity;
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  // Pipeline stages operations
  async getPipelineStages(pipelineId?: number): Promise<PipelineStage[]> {
    if (pipelineId) {
      return await db.select().from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipelineId))
        .orderBy(pipelineStages.posicaoestagio, pipelineStages.position);
    }
    return await db.select().from(pipelineStages)
      .orderBy(pipelineStages.posicaoestagio, pipelineStages.position);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    // Check if pipeline already has 12 stages
    const existingStages = await db
      .select({ count: count() })
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, stage.pipelineId));

    if (existingStages[0].count >= 12) {
      throw new Error("Pipeline cannot have more than 12 stages");
    }

    // Get the next sequential position
    const maxPositionResult = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(posicaoestagio), 0)` })
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, stage.pipelineId));

    const nextPosition = (maxPositionResult[0]?.maxPos || 0) + 1;

    const [newStage] = await db
      .insert(pipelineStages)
      .values({
        ...stage,
        posicaoestagio: nextPosition,
        position: nextPosition
      })
      .returning();
    return newStage;
  }

  async updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage> {
    const [updatedStage] = await db
      .update(pipelineStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(eq(pipelineStages.id, id))
      .returning();
    return updatedStage;
  }

  async updateStagePositions(stages: { id: number; posicaoestagio: number }[]): Promise<void> {
    console.log("=== STORAGE: Updating stage positions with automatic reordering ===");

    // First, validate that we don't exceed 12 stages
    if (stages.length > 12) {
      throw new Error("Pipeline cannot have more than 12 stages");
    }

    // Update positions and ensure sequential ordering (1-12)
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const newPosition = i + 1; // Start from 1, not 0

      console.log(`📝 STORAGE: Updating stage ${stage.id} to position ${newPosition}`);

      await db
        .update(pipelineStages)
        .set({ 
          posicaoestagio: newPosition,
          position: newPosition, // Also update the old position field for consistency
          updatedAt: new Date() 
        })
        .where(eq(pipelineStages.id, stage.id));
    }

    console.log("✅ STORAGE: All positions updated with sequential ordering");
  }

  async deletePipelineStage(id: number): Promise<void> {
    // First get the stage being deleted to know its pipeline
    const [stageToDelete] = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, id));

    if (!stageToDelete) {
      throw new Error("Stage not found");
    }

    // Delete the stage
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));

    // Get all remaining stages in the same pipeline ordered by current position
    const remainingStages = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, stageToDelete.pipelineId))
      .orderBy(pipelineStages.posicaoestagio, pipelineStages.position, pipelineStages.id);

    // Reorder all remaining stages to ensure sequential positions 1, 2, 3, etc.
    for (let i = 0; i < remainingStages.length; i++) {
      const newPosition = i + 1;
      await db
        .update(pipelineStages)
        .set({ 
          posicaoestagio: newPosition,
          position: newPosition,
          updatedAt: new Date() 
        })
        .where(eq(pipelineStages.id, remainingStages[i].id));
    }

    console.log(`✅ STORAGE: Stage ${id} deleted and remaining stages reordered`);
  }

  async getPipelineStage(stageId: number): Promise<PipelineStage | undefined> {
    try {
      console.log(`📊 STORAGE: Querying pipeline stage with ID ${stageId} (type: ${typeof stageId})`);

      if (!Number.isInteger(stageId) || stageId <= 0) {
        console.log(`❌ STORAGE: Invalid stage ID format: ${stageId}`);
        return undefined;
      }

      const stages = await db
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.id, stageId))
        .limit(1);

      const stage = stages[0];

      if (stage) {
        console.log(`✅ STORAGE: Stage found - ID: ${stage.id}, Title: "${stage.title}", Position: ${stage.position}`);
        return stage;
      } else {
        console.log(`❌ STORAGE: Stage with ID ${stageId} not found in database`);

        // Additional debugging: let's see what stages DO exist
        const allStages = await db.select({ id: pipelineStages.id, title: pipelineStages.title }).from(pipelineStages);
        console.log(`📋 STORAGE: Available stages in database:`, allStages);

        return undefined;
      }
    } catch (error) {
      console.error(`💥 STORAGE ERROR: Failed to get pipeline stage ${stageId}:`, error);
      console.error(`💥 STORAGE ERROR STACK:`, error instanceof Error ? error.stack : "No stack trace");
      throw error;
    }
  }

  async updateStagePositions(stages: Array<{ id: number; position: number }>): Promise<void> {
    try {
      console.log("=== STORAGE: Updating stage positions ===");

      // Update each stage position in database
      for (const stage of stages) {
        const stageId = Number(stage.id);
        const position = Number(stage.position);

        console.log(`📝 STORAGE: Updating stage ${stageId} to position ${position}`);

        const result = await db
          .update(pipelineStages)
          .set({ 
            position: position, 
            updatedAt: new Date() 
          })
          .where(eq(pipelineStages.id, stageId))
          .returning();

        console.log(`📝 STORAGE: Updated stage ${stageId}, result:`, result);
      }

      console.log("✅ STORAGE: All positions updated successfully");
    } catch (error) {
      console.error("❌ STORAGE: Failed to update stage positions:", error);
      throw error;
    }
  }



  // Pipeline operations
  async getPipelines(): Promise<Pipeline[]> {
    return await db.select().from(pipelines).orderBy(pipelines.name);
  }

  async getPipeline(id: number): Promise<Pipeline | undefined> {
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id));
    return pipeline;
  }

  async createPipeline(pipeline: InsertPipeline): Promise<Pipeline> {
    const [created] = await db.insert(pipelines).values(pipeline).returning();

    // Create default stages for new pipeline
    const defaultStages = [
      { title: "Prospecção", position: 0, color: "#3b82f6", isDefault: true },
      { title: "Qualificação", position: 1, color: "#f59e0b", isDefault: true },
      { title: "Proposta", position: 2, color: "#10b981", isDefault: true },
      { title: "Fechamento", position: 3, color: "#ef4444", isDefault: true },
    ];

    for (const stage of defaultStages) {
      await db.insert(pipelineStages).values({
        ...stage,
        pipelineId: created.id,
      });
    }

    return created;
  }

  async updatePipeline(id: number, pipeline: Partial<InsertPipeline>): Promise<Pipeline> {
    const [updated] = await db
      .update(pipelines)
      .set({ ...pipeline, updatedAt: new Date() })
      .where(eq(pipelines.id, id))
      .returning();
    
    return updated;
  }

  async deletePipeline(id: number): Promise<void> {
    await db.delete(pipelines).where(eq(pipelines.id, id));
  }

  // Dashboard metrics
  async getDashboardMetrics(): Promise<{
    totalContacts: number;
    activeCompanies: number;
    openDeals: number;
    projectedRevenue: string;
    stageMetrics: Array<{
      stage: string;
      count: number;
      totalValue: string;
    }>;
  }> {
    const [contactsCount] = await db.select({ count: count() }).from(contacts);
    const [companiesCount] = await db.select({ count: count() }).from(companies);
    const [openDealsCount] = await db.select({ count: count() }).from(deals);

    // Calculate projected revenue from all open deals (excluding closed)
    const openDeals = await db
      .select({ value: deals.value })
      .from(deals)
      .where(ne(deals.stage, 'fechamento'));

    const projectedRevenue = openDeals.reduce((sum, deal) => {
      return sum + (parseFloat(deal.value || '0'));
    }, 0);

    // Get metrics by stage
    const stageMetrics = await db
      .select({
        stage: deals.stage,
        count: count(),
        totalValue: sum(deals.value)
      })
      .from(deals)
      .groupBy(deals.stage)
      .orderBy(deals.stage);

    return {
      totalContacts: contactsCount.count,
      activeCompanies: companiesCount.count,
      openDeals: openDealsCount.count,
      projectedRevenue: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(projectedRevenue),
      stageMetrics: stageMetrics.map(metric => ({
        stage: metric.stage,
        count: metric.count,
        totalValue: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(parseFloat(metric.totalValue || '0')),
      })),
    };
  }

  // Contact import operations
  async importContacts(contactsData: InsertContact[]): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    for (const contactData of contactsData) {
      try {
        await this.createContact(contactData);
        success++;
      } catch (error) {
        errors.push(`Erro ao importar contato ${contactData.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    return { success, errors };
  }

  async getAvailableTags(): Promise<string[]> {
    const result = await db
      .select({ tags: contacts.tags })
      .from(contacts)
      .where(isNotNull(contacts.tags));

    const allTags = new Set<string>();
    result.forEach(row => {
      if (row.tags) {
        row.tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }

  async createContactsFromImport(
    data: any[], 
    pipelineId?: number, 
    tags: string[] = [],
    fieldMapping: any = {}
  ): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    console.log('=== INÍCIO DA IMPORTAÇÃO ===');
    console.log('Total de linhas para processar:', data.length);
    console.log('Pipeline ID:', pipelineId);
    console.log('Tags fornecidas:', tags);
    console.log('Amostra dos dados:', data.slice(0, 3));

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        console.log(`\n--- Processando linha ${i + 1} ---`);
        console.log('Dados da linha:', row);

        // Use field mapping to extract data
        let name = '';
        let email = null;
        let phone = null;
        let position = null;
        let status = 'active';
        let company = null;

        // Apply field mapping
        Object.keys(fieldMapping).forEach(column => {
          const field = fieldMapping[column];
          const value = row[column];

          if (!value || field === 'ignore') return;

          switch (field) {
            case 'name':
              name = value.toString().trim();
              break;
            case 'email':
              email = value.toString().trim();
              break;
            case 'phone':
              phone = value.toString().trim();
              break;
            case 'position':
              position = value.toString().trim();
              break;
            case 'status':
              status = value.toString().toLowerCase();
              break;
            case 'company':
              company = value.toString().trim();
              break;
          }
        });

        // Fallback to old mapping if no field mapping provided
        if (Object.keys(fieldMapping).length === 0) {
          name = row.Nome || row.Name || row.nome || row.name || 
                row.NOME || row.NAME || '';
          email = row.Email || row.email || row['E-mail'] || row['e-mail'] || 
                 row.EMAIL || row['E-MAIL'] || null;
          phone = row.Telefone || row.Phone || row.telefone || row.phone || 
                 row.TELEFONE || row.PHONE || null;
          position = row.Cargo || row.Position || row.cargo || row.position || 
                    row.CARGO || row.POSITION || null;
          status = row.Status || row.status || row.STATUS || 'active';
          company = row.Empresa || row.Company || row.empresa || row.company ||
                   row.EMPRESA || row.COMPANY;
        }

        console.log('Campos extraídos:', { name, email, phone, position, status });

        // Handle company creation if needed
        let companyId: number | null = null;
        if (company && company.toString().trim() !== '') {
          const companyName = company.toString().trim();
          const [existingCompany] = await db
            .select()
            .from(companies)
            .where(eq(companies.name, companyName))
            .limit(1);

          if (existingCompany.length > 0) {
            companyId = existingCompany[0].id;
            console.log('Empresa existente encontrada:', companyName, companyId);
          } else {
            // Create new company
            const newCompany = await this.createCompany({
              name: companyName,
              sector: null,
              website: null,
              phone: null,
              email: null,
              address: null
            });
            companyId = newCompany.id;
            console.log('Nova empresa criada:', companyName, companyId);
          }
        }

        const contactData: InsertContact = {
          name: name.toString().trim(),
          email: email ? email.toString().trim() : null,
          phone: phone ? phone.toString().trim() : null,
          position: position ? position.toString().trim() : null,
          status: status.toString().toLowerCase(),
          source: 'import',
          pipelineId: pipelineId || null,
          companyId: companyId,
          tags: [...tags] // Add provided tags
        };

        // Add any additional tags from the row
        const rowTags = row.Tags || row.tags || row.TAGS;
        if (rowTags) {
          const tagsArray = Array.isArray(rowTags) 
            ? rowTags 
            : rowTags.toString().split(',').map((t: string) => t.trim()).filter(Boolean);
          contactData.tags = [...(contactData.tags || []), ...tagsArray];
          console.log('Tags adicionadas:', tagsArray);
        }

        // Validate required fields
        if (!contactData.name || contactData.name.trim() === '') {
          const error = `Linha ${i + 1}: Nome é obrigatório (valor encontrado: "${name}")`;
          console.log('ERRO:', error);
          errors.push(error);
          continue;
        }

        // Validate email format if provided
        if (contactData.email && contactData.email.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(contactData.email)) {
            console.log('Email inválido, removendo:', contactData.email);
            contactData.email = null;
          }
        }

        console.log('Dados finais do contato:', contactData);

        // Create contact
        const createdContact = await this.createContact(contactData);
        console.log('Contato criado com sucesso:', createdContact.id);

        // If pipeline is provided, create a deal automatically
        if (pipelineId) {
          try {
            // Get first stage of the pipeline
            const pipelineStages = await this.getPipelineStages(pipelineId);
            const firstStage = pipelineStages.find(stage => stage.position === 0) || pipelineStages[0];

            if (firstStage) {
              const dealData = {
                title: `Oportunidade - ${createdContact.name}`,
                description: `Oportunidade criada automaticamente via importação de contatos`,
                stage: firstStage.title,
                pipelineId: pipelineId,
                contactId: createdContact.id,
                companyId: createdContact.companyId,
                value: null,
                expectedCloseDate: null,
              };

              const createdDeal = await this.createDeal(dealData);
              console.log('Oportunidade criada automaticamente:', createdDeal.id);
            }
          } catch (dealError) {
            console.error('Erro ao criar oportunidade automática:', dealError);
            // Don't fail the contact import if deal creation fails
          }
        }

        success++;

      } catch (error) {
        const errorMsg = `Linha ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error('ERRO na linha:', errorMsg);
        console.error('Stack trace:', error);
        errors.push(errorMsg);
      }
    }

    console.log('\n=== FINAL DA IMPORTAÇÃO ===');
    console.log('Sucessos:', success);
    console.log('Erros:', errors.length);
    console.log('Lista de erros:', errors);

    return { success, errors };
  }

  // ActiveCampaign Integration Methods
  async getActiveCampaignConfigs(userId: string): Promise<ActiveCampaignConfig[]> {
    return await db
      .select()
      .from(activeCampaignConfigs)
      .where(eq(activeCampaignConfigs.userId, userId))
      .orderBy(desc(activeCampaignConfigs.createdAt));
  }

  async getActiveCampaignConfigById(configId: number, userId?: string): Promise<ActiveCampaignConfig | undefined> {
    const query = db
      .select()
      .from(activeCampaignConfigs)
      .where(eq(activeCampaignConfigs.id, configId));

    if (userId) {
      query.where(and(eq(activeCampaignConfigs.id, configId), eq(activeCampaignConfigs.userId, userId)));
    }

    const [config] = await query;
    return config || undefined;
  }

  async createActiveCampaignConfig(config: InsertActiveCampaignConfig): Promise<ActiveCampaignConfig> {
    // Validate required fields
    if (!config.userId || !config.defaultPipelineId) {
      throw new Error("User ID and pipeline ID are required for ActiveCampaign configuration");
    }

    // Remove name field from config as it doesn't exist in the table
    const { name, ...configData } = config as any;

    const [newConfig] = await db
      .insert(activeCampaignConfigs)
      .values({
        ...configData,
        defaultTags: configData.defaultTags || [],
        fieldMapping: configData.fieldMapping || {}
      })
      .returning();
    return newConfig;
  }

  async updateActiveCampaignConfig(configId: number, config: Partial<InsertActiveCampaignConfig>): Promise<ActiveCampaignConfig | undefined> {
    const updateData: any = { ...config, updatedAt: new Date() };

    const [updatedConfig] = await db
      .update(activeCampaignConfigs)
      .set(updateData)
      .where(eq(activeCampaignConfigs.id, configId))
      .returning();
    return updatedConfig || undefined;
  }

  async deleteActiveCampaignConfigById(configId: number, userId: string): Promise<void> {
    await db
      .delete(activeCampaignConfigs)
      .where(and(eq(activeCampaignConfigs.id, configId), eq(activeCampaignConfigs.userId, userId)));
  }

  async createWebhookLog(log: InsertActiveCampaignWebhookLog): Promise<ActiveCampaignWebhookLog> {
    const [newLog] = await db
      .insert(activeCampaignWebhookLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getWebhookLogs(configId?: number, limit = 50, offset = 0): Promise<ActiveCampaignWebhookLog[]> {
    const baseQuery = db
      .select()
      .from(activeCampaignWebhookLogs)
      .orderBy(desc(activeCampaignWebhookLogs.processedAt))
      .limit(limit)
      .offset(offset);

    if (configId) {
      return await baseQuery.where(eq(activeCampaignWebhookLogs.configId, configId));
    }

    return await baseQuery;
  }

  // WhatsApp Session operations
  async getWhatsappSessions(): Promise<WhatsappSession[]> {
    return await db.select().from(whatsappSessions).orderBy(desc(whatsappSessions.createdAt));
  }

  async getWhatsappSession(id: number): Promise<WhatsappSession | undefined> {
    const [session] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.id, id));
    return session;
  }

  async createWhatsappSession(session: InsertWhatsappSession): Promise<WhatsappSession> {
    const [newSession] = await db.insert(whatsappSessions).values(session).returning();
    return newSession;
  }

  async updateWhatsappSession(id: number, session: Partial<InsertWhatsappSession>): Promise<WhatsappSession> {
    const [updatedSession] = await db
      .update(whatsappSessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(whatsappSessions.id, id))
      .returning();
    return updatedSession;
  }

  async deleteWhatsappSession(id: number): Promise<void> {
    await db.delete(whatsappSessions).where(eq(whatsappSessions.id, id));
  }

  // WhatsApp Contact operations
  async getWhatsappContacts(sessionId?: number): Promise<WhatsappContact[]> {
    const query = db.select().from(whatsappContacts).orderBy(desc(whatsappContacts.updatedAt));
    
    if (sessionId) {
      return await query;
    }
    
    return await query;
  }

  async getWhatsappContact(phoneNumber: string): Promise<WhatsappContact | undefined> {
    const [contact] = await db.select().from(whatsappContacts).where(eq(whatsappContacts.phoneNumber, phoneNumber));
    return contact;
  }

  async createWhatsappContact(contact: InsertWhatsappContact): Promise<WhatsappContact> {
    const [newContact] = await db.insert(whatsappContacts).values(contact).returning();
    return newContact;
  }

  async updateWhatsappContact(id: number, contact: Partial<InsertWhatsappContact>): Promise<WhatsappContact> {
    const [updatedContact] = await db
      .update(whatsappContacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(whatsappContacts.id, id))
      .returning();
    return updatedContact;
  }

  // WhatsApp Message operations
  async getWhatsappMessages(phoneNumber?: string, sessionId?: number, limit = 100, offset = 0): Promise<WhatsappMessageWithRelations[]> {
    const baseQuery = db
      .select({
        id: whatsappMessages.id,
        sessionId: whatsappMessages.sessionId,
        messageId: whatsappMessages.messageId,
        fromNumber: whatsappMessages.fromNumber,
        toNumber: whatsappMessages.toNumber,
        messageType: whatsappMessages.messageType,
        content: whatsappMessages.content,
        mediaUrl: whatsappMessages.mediaUrl,
        timestamp: whatsappMessages.timestamp,
        isIncoming: whatsappMessages.isIncoming,
        contactId: whatsappMessages.contactId,
        dealId: whatsappMessages.dealId,
        status: whatsappMessages.status,
        createdAt: whatsappMessages.createdAt,
        session: whatsappSessions,
        contact: contacts,
        deal: deals,
      })
      .from(whatsappMessages)
      .leftJoin(whatsappSessions, eq(whatsappMessages.sessionId, whatsappSessions.id))
      .leftJoin(contacts, eq(whatsappMessages.contactId, contacts.id))
      .leftJoin(deals, eq(whatsappMessages.dealId, deals.id))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit)
      .offset(offset);

    const conditions = [];
    if (phoneNumber) {
      conditions.push(
        or(
          eq(whatsappMessages.fromNumber, phoneNumber),
          eq(whatsappMessages.toNumber, phoneNumber)
        )
      );
    }

    if (sessionId) {
      conditions.push(eq(whatsappMessages.sessionId, sessionId));
    }

    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions)) as WhatsappMessageWithRelations[];
    }

    return await baseQuery as WhatsappMessageWithRelations[];
  }

  async createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db.insert(whatsappMessages).values(message).returning();
    return newMessage;
  }

  async updateWhatsappMessage(id: number, message: Partial<InsertWhatsappMessage>): Promise<WhatsappMessage> {
    const [updatedMessage] = await db
      .update(whatsappMessages)
      .set(message)
      .where(eq(whatsappMessages.id, id))
      .returning();
    return updatedMessage;
  }
}

export const storage = new DatabaseStorage();