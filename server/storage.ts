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
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, count, desc, ne, sql, isNotNull, sum } from "drizzle-orm";

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
  updateStagePositions(stages: Array<{ id: number; position: number }>): Promise<void>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    totalContacts: number;
    activeCompanies: number;
    openDeals: number;
    projectedRevenue: string;
  }>;

  // ActiveCampaign Integration
  getActiveCampaignConfig(userId: string): Promise<ActiveCampaignConfig | undefined>;
  createActiveCampaignConfig(config: InsertActiveCampaignConfig): Promise<ActiveCampaignConfig>;
  updateActiveCampaignConfig(userId: string, config: Partial<InsertActiveCampaignConfig>): Promise<ActiveCampaignConfig | undefined>;
  deleteActiveCampaignConfig(userId: string): Promise<void>;
  
  // ActiveCampaign Webhook Logs
  createWebhookLog(log: InsertActiveCampaignWebhookLog): Promise<ActiveCampaignWebhookLog>;
  getWebhookLogs(configId?: number, limit?: number, offset?: number): Promise<ActiveCampaignWebhookLog[]>;
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
    let query = db.select().from(companies);

    if (search) {
      query = query.where(ilike(companies.name, `%${search}%`));
    }

    return await query
      .orderBy(companies.name)
      .limit(limit)
      .offset(offset);
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company> {
    const [updated] = await db
      .update(companies)
      .set({ ...company, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getCompanyCount(search?: string): Promise<number> {
    let query = db.select({ count: count() }).from(companies);

    if (search) {
      query = query.where(ilike(companies.name, `%${search}%`));
    }

    const [result] = await query;
    return result.count;
  }

  // Contact operations
  async getContacts(search?: string, companyId?: number, limit = 50, offset = 0): Promise<ContactWithCompany[]> {
    let query = db
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
    if (search) {
      conditions.push(ilike(contacts.name, `%${search}%`));
    }
    if (companyId) {
      conditions.push(eq(contacts.companyId, companyId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(contacts.name)
      .limit(limit)
      .offset(offset) as ContactWithCompany[];
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

    return contact as ContactWithCompany;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: number, contact: Partial<InsertContact>): Promise<Contact> {
    const [updated] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getContactCount(search?: string, companyId?: number): Promise<number> {
    let query = db.select({ count: count() }).from(contacts);

    const conditions = [];
    if (search) {
      conditions.push(ilike(contacts.name, `%${search}%`));
    }
    if (companyId) {
      conditions.push(eq(contacts.companyId, companyId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [result] = await query;
    return result.count;
  }

  // Deal operations
  async getDeals(stage?: string, limit: number = 50, offset: number = 0, contactId?: number): Promise<DealWithRelations[]> {
    let query = db
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
      .leftJoin(companies, eq(deals.companyId, companies.id));

    const conditions = [];
    if (stage) {
      conditions.push(eq(deals.stage, stage));
    }
    if (contactId) {
      conditions.push(eq(deals.contactId, contactId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(desc(deals.createdAt))
      .limit(limit)
      .offset(offset) as DealWithRelations[];
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
      .where(eq(deals.id, id));

    return deal as DealWithRelations;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  async updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal> {
    const [updated] = await db
      .update(deals)
      .set({ ...deal, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }

  async deleteDeal(id: number): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getDealsByStage(pipelineId?: number): Promise<{ stage: string; count: number; deals: DealWithRelations[] }[]> {
    let stagesQuery = db.select().from(pipelineStages);
    
    if (pipelineId) {
      stagesQuery = stagesQuery.where(eq(pipelineStages.pipelineId, pipelineId));
    }

    const stages = await stagesQuery.orderBy(pipelineStages.position);
    
    const result = [];
    for (const stage of stages) {
      const stageDeals = await this.getDeals(stage.title, 100, 0);
      result.push({
        stage: stage.title,
        count: stageDeals.length,
        deals: stageDeals,
      });
    }

    return result;
  }

  // Activity operations
  async getActivities(contactId?: number, dealId?: number, userId?: string, limit = 50, offset = 0): Promise<ActivityWithRelations[]> {
    let query = db
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
          pipelineId: deals.pipelineId,
          expectedCloseDate: deals.expectedCloseDate,
          contactId: deals.contactId,
          companyId: deals.companyId,
          ownerId: deals.ownerId,
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
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset) as ActivityWithRelations[];
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
          pipelineId: deals.pipelineId,
          expectedCloseDate: deals.expectedCloseDate,
          contactId: deals.contactId,
          companyId: deals.companyId,
          ownerId: deals.ownerId,
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

    return activity as ActivityWithRelations;
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity> {
    const [updated] = await db
      .update(activities)
      .set({ ...activity, updatedAt: new Date() })
      .where(eq(activities.id, id))
      .returning();
    return updated;
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  // Pipeline stages operations
  async getPipelineStages(pipelineId?: number): Promise<PipelineStage[]> {
    let query = db.select().from(pipelineStages);
    
    if (pipelineId) {
      query = query.where(eq(pipelineStages.pipelineId, pipelineId));
    }

    return await query.orderBy(pipelineStages.position);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [created] = await db.insert(pipelineStages).values(stage).returning();
    return created;
  }

  async updatePipelineStage(id: number, stage: Partial<InsertPipelineStage>): Promise<PipelineStage> {
    const [updated] = await db
      .update(pipelineStages)
      .set({ ...stage, updatedAt: new Date() })
      .where(eq(pipelineStages.id, id))
      .returning();
    return updated;
  }

  async deletePipelineStage(id: number): Promise<void> {
    console.log(`🗑️ STORAGE: Deleting pipeline stage with ID ${id}`);
    
    // First get the stage being deleted to know its position and pipeline
    const stageToDelete = await db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, id))
      .limit(1);

    if (stageToDelete.length === 0) {
      console.log(`❌ STORAGE: Stage ${id} not found`);
      return;
    }

    const deletedStage = stageToDelete[0];
    console.log(`🗑️ STORAGE: Deleting stage at position ${deletedStage.position} in pipeline ${deletedStage.pipelineId}`);

    // Delete the stage
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));

    // Update positions of remaining stages in the same pipeline
    await db
      .update(pipelineStages)
      .set({
        position: sql`${pipelineStages.position} - 1`,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(pipelineStages.pipelineId, deletedStage.pipelineId),
          sql`${pipelineStages.position} > ${deletedStage.position}`
        )
      );

    console.log(`✅ STORAGE: Stage ${id} deleted and remaining stages reordered`);
  }

  async updateStagePositions(stages: Array<{ id: number; position: number }>): Promise<void> {
    try {
      console.log("=== STORAGE: Updating stage positions ===");
      console.log("STORAGE: Received stages:", JSON.stringify(stages));

      // Validate all stage IDs first
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        console.log(`STORAGE: Processing stage ${i}:`, stage);
        
        const stageId = Number(stage.id);
        const position = Number(stage.position);

        console.log(`STORAGE: Converted values - stageId: ${stageId} (${typeof stageId}), position: ${position} (${typeof position})`);
        console.log(`STORAGE: Validations - isInteger(stageId): ${Number.isInteger(stageId)}, stageId > 0: ${stageId > 0}`);
        console.log(`STORAGE: Validations - isInteger(position): ${Number.isInteger(position)}, position >= 0: ${position >= 0}`);

        if (!Number.isInteger(stageId) || stageId <= 0) {
          const errorMsg = `Invalid stage ID: ${stage.id} (converted: ${stageId}, isInteger: ${Number.isInteger(stageId)}, > 0: ${stageId > 0})`;
          console.log(`❌ STORAGE: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        if (!Number.isInteger(position) || position < 0) {
          const errorMsg = `Invalid position: ${stage.position} (converted: ${position}, isInteger: ${Number.isInteger(position)}, >= 0: ${position >= 0}) for stage ${stageId}`;
          console.log(`❌ STORAGE: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        // Check if stage exists
        console.log(`STORAGE: Checking if stage ${stageId} exists...`);
        const existingStage = await db
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(eq(pipelineStages.id, stageId))
          .limit(1);

        console.log(`STORAGE: Stage existence check result:`, existingStage);
        if (existingStage.length === 0) {
          const errorMsg = `Stage with ID ${stageId} not found`;
          console.log(`❌ STORAGE: ${errorMsg}`);
          throw new Error(errorMsg);
        }

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

    // Create default stages for the new pipeline
    const defaultStages = [
      { title: "Prospecção", position: 0, color: "#6b7280", isDefault: true },
      { title: "Qualificação", position: 1, color: "#3b82f6", isDefault: false },
      { title: "Proposta", position: 2, color: "#f59e0b", isDefault: false },
      { title: "Negociação", position: 3, color: "#ef4444", isDefault: false },
      { title: "Fechamento", position: 4, color: "#10b981", isDefault: false },
    ];

    for (const stage of defaultStages) {
      await db.insert(pipelineStages).values({
        pipelineId: created.id,
        title: stage.title,
        position: stage.position,
        color: stage.color,
        isDefault: stage.isDefault,
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

    return {
      totalContacts: contactsCount.count,
      activeCompanies: companiesCount.count,
      openDeals: openDealsCount.count,
      projectedRevenue: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(projectedRevenue),
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

    return Array.from(allTags);
  }

  async createContactsFromImport(
    data: any[],
    pipelineId?: number,
    tags?: string[]
  ): Promise<{ success: number; errors: string[] }> {
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i];
        console.log(`Processando linha ${i + 1}:`, row);

        // Validate required fields
        if (!row.name || !row.name.trim()) {
          errors.push(`Linha ${i + 1}: Nome é obrigatório (valor encontrado: "${row.name}")`);
          continue;
        }

        const contactData: InsertContact = {
          name: row.name.trim(),
          email: row.email || null,
          phone: row.phone || null,
          position: row.position || null,
          companyId: row.companyId || null,
          tags: tags || [],
          status: 'prospect',
        };

        const createdContact = await this.createContact(contactData);

        // Create deal if pipelineId is provided
        if (pipelineId && createdContact) {
          await this.createDeal({
            title: `Oportunidade - ${createdContact.name}`,
            contactId: createdContact.id,
            pipelineId: pipelineId,
            stage: 'Prospecção',
            value: '0',
            description: 'Oportunidade criada automaticamente via importação de contatos',
          });
        }

        success++;
      } catch (error) {
        errors.push(`Linha ${i + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    }

    return { success, errors };
  }

  // ActiveCampaign Integration
  async getActiveCampaignConfig(userId: string): Promise<ActiveCampaignConfig | undefined> {
    const [config] = await db
      .select()
      .from(activeCampaignConfigs)
      .where(eq(activeCampaignConfigs.userId, userId));
    return config;
  }

  async createActiveCampaignConfig(config: InsertActiveCampaignConfig): Promise<ActiveCampaignConfig> {
    const [newConfig] = await db
      .insert(activeCampaignConfigs)
      .values(config)
      .returning();
    return newConfig;
  }

  async updateActiveCampaignConfig(userId: string, config: Partial<InsertActiveCampaignConfig>): Promise<ActiveCampaignConfig | undefined> {
    const [updatedConfig] = await db
      .update(activeCampaignConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(activeCampaignConfigs.userId, userId))
      .returning();
    return updatedConfig || undefined;
  }

  async deleteActiveCampaignConfig(userId: string): Promise<void> {
    await db
      .delete(activeCampaignConfigs)
      .where(eq(activeCampaignConfigs.userId, userId));
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
}

export const storage = new DatabaseStorage();