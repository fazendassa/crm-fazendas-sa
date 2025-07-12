import { db } from './db';
import { 
  users, companies, contacts, deals, activities, pipelines, pipelineStages, 
  whatsappSessions, whatsappMessages, activeCampaignConfigs, activeCampaignWebhookLogs
} from '@shared/schema';
import { eq, and, desc, like, count, sql } from 'drizzle-orm';

export interface IStorage {
  // WhatsApp operations
  getWhatsappSessions(userId: string): Promise<any[]>;
  getWhatsappMessages(sessionId: number, chatId?: string, limit?: number): Promise<any[]>;
  createWhatsappSession(session: any): Promise<any>;
  createWhatsappMessage(message: any): Promise<any>;
  updateWhatsappMessageStatus(messageId: string, isRead: boolean): Promise<void>;
  deleteWhatsappSession(sessionId: number): Promise<void>;

  // Core operations
  getUser(id: string): Promise<any>;
  upsertUser(user: any): Promise<any>;
  getAllUsers(): Promise<any[]>;
  updateUserRole(id: string, role: string): Promise<void>;

  getCompanies(search?: string, limit?: number, offset?: number): Promise<any[]>;
  getCompany(id: number): Promise<any>;
  createCompany(company: any): Promise<any>;
  updateCompany(id: number, company: any): Promise<any>;
  deleteCompany(id: number): Promise<void>;
  getCompanyCount(search?: string): Promise<number>;

  getContacts(search?: string, companyId?: number, limit?: number, offset?: number): Promise<any[]>;
  getContact(id: number): Promise<any>;
  createContact(contact: any): Promise<any>;
  updateContact(id: number, contact: any): Promise<any>;
  deleteContact(id: number): Promise<void>;
  getContactCount(search?: string, companyId?: number): Promise<number>;

  getDeals(stage?: string, limit?: number, offset?: number, contactId?: number): Promise<any[]>;
  getDeal(id: number): Promise<any>;
  createDeal(deal: any): Promise<any>;
  updateDeal(id: number, deal: any): Promise<any>;
  deleteDeal(id: number): Promise<void>;
  getDealsByStage(pipelineId?: number): Promise<any[]>;

  getActivities(contactId?: number, dealId?: number, userId?: string, limit?: number, offset?: number): Promise<any[]>;
  getActivity(id: number): Promise<any>;
  createActivity(activity: any): Promise<any>;
  updateActivity(id: number, activity: any): Promise<any>;
  deleteActivity(id: number): Promise<void>;

  getPipelines(): Promise<any[]>;
  getPipeline(id: number): Promise<any>;
  createPipeline(pipeline: any): Promise<any>;
  updatePipeline(id: number, pipeline: any): Promise<any>;
  deletePipeline(id: number): Promise<void>;

  getPipelineStages(pipelineId?: number): Promise<any[]>;
  createPipelineStage(stage: any): Promise<any>;
  updatePipelineStage(id: number, stage: any): Promise<any>;
  deletePipelineStage(id: number): Promise<void>;
  updateStagePositions(stages: any[]): Promise<void>;

  getDashboardMetrics(): Promise<any>;
  importContacts(contacts: any[]): Promise<any>;
  getAvailableTags(): Promise<string[]>;
  createContactsFromImport(data: any[], pipelineId?: number, tags?: string[]): Promise<any>;

  getActiveCampaignConfigs(userId: string): Promise<any[]>;
  getActiveCampaignConfigById(configId: number, userId?: string): Promise<any>;
  createActiveCampaignConfig(config: any): Promise<any>;
  updateActiveCampaignConfig(configId: number, config: any): Promise<any>;
  deleteActiveCampaignConfigById(configId: number, userId: string): Promise<void>;
  createWebhookLog(log: any): Promise<any>;
  getWebhookLogs(configId?: number, limit?: number, offset?: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getWhatsappSessions(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.userId, userId))
      .orderBy(desc(whatsappSessions.createdAt));
  }

  async getWhatsappMessages(sessionId: number, chatId?: string, limit = 100): Promise<any[]> {
    let query = db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.sessionId, sessionId))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);

    if (chatId) {
      query = query.where(and(
        eq(whatsappMessages.sessionId, sessionId),
        eq(whatsappMessages.chatId, chatId)
      ));
    }

    return await query;
  }

  async createWhatsappSession(session: any): Promise<any> {
    const [newSession] = await db
      .insert(whatsappSessions)
      .values(session)
      .returning();
    return newSession;
  }

  async createWhatsappMessage(message: any): Promise<any> {
    const [newMessage] = await db
      .insert(whatsappMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async updateWhatsappMessageStatus(messageId: string, isRead: boolean): Promise<void> {
    await db
      .update(whatsappMessages)
      .set({ isRead })
      .where(eq(whatsappMessages.messageId, messageId));
  }

  async deleteWhatsappSession(sessionId: number): Promise<void> {
    await db.delete(whatsappSessions).where(eq(whatsappSessions.id, sessionId));
  }

  async getUser(id: string): Promise<any> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async upsertUser(userData: any): Promise<any> {
    const [existingUser] = await db.select().from(users).where(eq(users.id, userData.id)).limit(1);

    if (existingUser) {
      const [updatedUser] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          updatedAt: new Date()
        })
        .where(eq(users.id, userData.id))
        .returning();
      return updatedUser;
    }

    const [newUser] = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newUser;
  }

  async getAllUsers(): Promise<any[]> {
    return await db.select().from(users);
  }

  async updateUserRole(id: string, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, id));
  }

  async getCompanies(search?: string, limit = 50, offset = 0): Promise<any[]> {
    let query = db.select().from(companies);
    if (search) {
      query = query.where(like(companies.name, `%${search}%`));
    }
    return await query.limit(limit).offset(offset);
  }

  async getCompany(id: number): Promise<any> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return company;
  }

  async createCompany(company: any): Promise<any> {
    const [newCompany] = await db.insert(companies).values(company).returning();
    return newCompany;
  }

  async updateCompany(id: number, company: any): Promise<any> {
    const [updatedCompany] = await db.update(companies).set(company).where(eq(companies.id, id)).returning();
    return updatedCompany;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getCompanyCount(search?: string): Promise<number> {
    let query = db.select({ count: count() }).from(companies);
    if (search) {
      query = query.where(like(companies.name, `%${search}%`));
    }
    const [result] = await query;
    return result.count;
  }

  async getContacts(search?: string, companyId?: number, limit = 50, offset = 0): Promise<any[]> {
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
          location: companies.location
        }
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id));

    if (search) {
      query = query.where(like(contacts.name, `%${search}%`));
    }
    if (companyId) {
      query = query.where(eq(contacts.companyId, companyId));
    }

    return await query.limit(limit).offset(offset);
  }

  async getContact(id: number): Promise<any> {
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
          location: companies.location
        }
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(eq(contacts.id, id))
      .limit(1);
    return contact;
  }

  async createContact(contact: any): Promise<any> {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  async updateContact(id: number, contact: any): Promise<any> {
    const [updatedContact] = await db.update(contacts).set(contact).where(eq(contacts.id, id)).returning();
    return updatedContact;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getContactCount(search?: string, companyId?: number): Promise<number> {
    let query = db.select({ count: count() }).from(contacts);
    if (search) {
      query = query.where(like(contacts.name, `%${search}%`));
    }
    if (companyId) {
      query = query.where(eq(contacts.companyId, companyId));
    }
    const [result] = await query;
    return result.count;
  }

  async getDeals(stage?: string, limit = 50, offset = 0, contactId?: number): Promise<any[]> {
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
        description: deals.description,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
        contact: {
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector
        }
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(companies, eq(deals.companyId, companies.id));

    if (stage) {
      query = query.where(eq(deals.stage, stage));
    }
    if (contactId) {
      query = query.where(eq(deals.contactId, contactId));
    }

    return await query.limit(limit).offset(offset);
  }

  async getDeal(id: number): Promise<any> {
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
          phone: contacts.phone
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector
        }
      })
      .from(deals)
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .where(eq(deals.id, id))
      .limit(1);
    return deal;
  }

  async createDeal(deal: any): Promise<any> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async updateDeal(id: number, deal: any): Promise<any> {
    const [updatedDeal] = await db.update(deals).set(deal).where(eq(deals.id, id)).returning();
    return updatedDeal;
  }

  async deleteDeal(id: number): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getDealsByStage(pipelineId?: number): Promise<{ stage: string; count: number; deals: DealWithRelations[] }[]> {
    console.log('=== getDealsByStage called ===');
    console.log('Pipeline ID:', pipelineId);

    // Get stages from pipeline_stages table if pipelineId is provided
    let stages: string[];
    if (pipelineId) {
      const pipelineStages = await this.getPipelineStages(pipelineId);
      stages = pipelineStages.map(s => s.title);
      console.log('Pipeline stages:', stages);
    } else {
      stages = ['Prospecção', 'Qualificação', 'Proposta', 'Fechamento'];
      console.log('Default stages:', stages);
    }

    const result = [];

    for (const stage of stages) {
      console.log(`\n--- Processing stage: ${stage} ---`);
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

      console.log(`Deals found for stage ${stage}:`, dealsInStage.length);
      console.log('Deals:', dealsInStage.map(d => ({ id: d.id, title: d.title, stage: d.stage })));

      result.push({
        stage,
        count: dealsInStage.length,
        deals: dealsInStage as DealWithRelations[],
      });
    }

    console.log('Final result:', result);
    return result;
  }

  async getActivities(contactId?: number, dealId?: number, userId?: string, limit = 50, offset = 0): Promise<any[]> {
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
          phone: contacts.phone
        },
        deal: {
          id: deals.id,
          title: deals.title,
          value: deals.value,
          stage: deals.stage
        },
        company: {
          id: companies.id,
          name: companies.name,
          sector: companies.sector
        }
      })
      .from(activities)
      .leftJoin(contacts, eq(activities.contactId, contacts.id))
      .leftJoin(deals, eq(activities.dealId, deals.id))
      .leftJoin(companies, eq(activities.companyId, companies.id));

    if (contactId) {
      query = query.where(eq(activities.contactId, contactId));
    }
    if (dealId) {
      query = query.where(eq(activities.dealId, dealId));
    }
    if (userId) {
      query = query.where(eq(activities.userId, userId));
    }

    return await query.limit(limit).offset(offset);
  }

  async getActivity(id: number): Promise<any> {
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
        updatedAt: activities.updatedAt
      })
      .from(activities)
      .where(eq(activities.id, id))
      .limit(1);
    return activity;
  }

  async createActivity(activity: any): Promise<any> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }

  async updateActivity(id: number, activity: any): Promise<any> {
    const [updatedActivity] = await db.update(activities).set(activity).where(eq(activities.id, id)).returning();
    return updatedActivity;
  }

  async deleteActivity(id: number): Promise<void> {
    await db.delete(activities).where(eq(activities.id, id));
  }

  async getPipelineStages(pipelineId?: number): Promise<any[]> {
    let query = db.select().from(pipelineStages);
    if (pipelineId) {
      query = query.where(eq(pipelineStages.pipelineId, pipelineId));
    }
    return await query.orderBy(pipelineStages.posicaoestagio);
  }

  async createPipelineStage(stage: any): Promise<any> {
    const [newStage] = await db.insert(pipelineStages).values(stage).returning();
    return newStage;
  }

  async updatePipelineStage(id: number, stage: any): Promise<any> {
    const [updatedStage] = await db.update(pipelineStages).set(stage).where(eq(pipelineStages.id, id)).returning();
    return updatedStage;
  }

  async deletePipelineStage(id: number): Promise<void> {
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  }

  async updateStagePositions(stages: any[]): Promise<void> {
    for (const stage of stages) {
      await db
        .update(pipelineStages)
        .set({ posicaoestagio: stage.position })
        .where(eq(pipelineStages.id, stage.id));
    }
  }

  async getPipelines(): Promise<any[]> {
    return await db.select().from(pipelines);
  }

  async getPipeline(id: number): Promise<any> {
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id)).limit(1);
    return pipeline;
  }

  async createPipeline(pipeline: any): Promise<any> {
    const [newPipeline] = await db.insert(pipelines).values(pipeline).returning();
    return newPipeline;
  }

  async updatePipeline(id: number, pipeline: any): Promise<any> {
    const [updatedPipeline] = await db.update(pipelines).set(pipeline).where(eq(pipelines.id, id)).returning();
    return updatedPipeline;
  }

  async deletePipeline(id: number): Promise<void> {
    await db.delete(pipelines).where(eq(pipelines.id, id));
  }

  async getDashboardMetrics(): Promise<any> {
    const [totalContacts] = await db.select({ count: count() }).from(contacts);
    const [activeCompanies] = await db.select({ count: count() }).from(companies);
    const [openDeals] = await db.select({ count: count() }).from(deals);
    const [revenue] = await db.select({ total: sql<number>`sum(${deals.value})` }).from(deals);

    return {
      totalContacts: totalContacts.count,
      activeCompanies: activeCompanies.count,
      openDeals: openDeals.count,
      projectedRevenue: revenue.total?.toString() || '0'
    };
  }

  async importContacts(contactsData: any[]): Promise<any> {
    const results = { success: 0, errors: [] as string[] };
    for (const contactData of contactsData) {
      try {
        await db.insert(contacts).values(contactData);
        results.success++;
      } catch (error) {
        results.errors.push(`Error importing contact: ${error}`);
      }
    }
    return results;
  }

  async getAvailableTags(): Promise<string[]> {
    const results = await db
      .select({ tags: contacts.tags })
      .from(contacts)
      .where(sql`${contacts.tags} IS NOT NULL`);

    const allTags = new Set<string>();
    for (const row of results) {
      if (row.tags) {
        row.tags.forEach((tag: string) => allTags.add(tag));
      }
    }
    return Array.from(allTags);
  }

  async createContactsFromImport(data: any[], pipelineId?: number, tags?: string[]): Promise<any> {
    const results = { success: 0, errors: [] as string[] };
    for (const item of data) {
      try {
        const contactData = {
          name: item.name || 'Unknown',
          email: item.email || null,
          phone: item.phone || null,
          position: item.position || null,
          companyId: item.companyId || null,
          tags: tags || [],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        await db.insert(contacts).values(contactData);
        results.success++;
      } catch (error) {
        results.errors.push(`Error creating contact: ${error}`);
      }
    }
    return results;
  }

  async getActiveCampaignConfigs(userId: string): Promise<any[]> {
    return await db.select().from(activeCampaignConfigs).where(eq(activeCampaignConfigs.userId, userId));
  }

  async getActiveCampaignConfigById(configId: number, userId?: string): Promise<any> {
    let query = db.select().from(activeCampaignConfigs).where(eq(activeCampaignConfigs.id, configId));
    if (userId) {
      query = query.where(and(eq(activeCampaignConfigs.id, configId), eq(activeCampaignConfigs.userId, userId)));
    }
    const [config] = await query.limit(1);
    return config;
  }

  async createActiveCampaignConfig(config: any): Promise<any> {
    const [newConfig] = await db.insert(activeCampaignConfigs).values(config).returning();
    return newConfig;
  }

  async updateActiveCampaignConfig(configId: number, config: any): Promise<any> {
    const [updatedConfig] = await db.update(activeCampaignConfigs).set(config).where(eq(activeCampaignConfigs.id, configId)).returning();
    return updatedConfig;
  }

  async deleteActiveCampaignConfigById(configId: number, userId: string): Promise<void> {
    await db.delete(activeCampaignConfigs).where(and(eq(activeCampaignConfigs.id, configId), eq(activeCampaignConfigs.userId, userId)));
  }

  async createWebhookLog(log: any): Promise<any> {
    const [newLog] = await db.insert(activeCampaignWebhookLogs).values(log).returning();
    return newLog;
  }

  async getWebhookLogs(configId?: number, limit = 50, offset = 0): Promise<any[]> {
    let query = db.select().from(activeCampaignWebhookLogs);
    if (configId) {
      query = query.where(eq(activeCampaignWebhookLogs.configId, configId));
    }
    return await query.limit(limit).offset(offset);
  }
}

export const storage = new DatabaseStorage();