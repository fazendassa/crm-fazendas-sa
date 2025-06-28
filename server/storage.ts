import {
  users,
  companies,
  contacts,
  deals,
  activities,
  pipelineStages,
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
  type PipelineStage,
  type InsertPipelineStage,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, and, count, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

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

  // Deal operations
  getDeals(stage?: string, limit?: number, offset?: number): Promise<DealWithRelations[]>;
  getDeal(id: number): Promise<DealWithRelations | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal>;
  deleteDeal(id: number): Promise<void>;
  getDealsByStage(): Promise<{ stage: string; count: number; deals: DealWithRelations[] }[]>;

  // Activity operations
  getActivities(contactId?: number, dealId?: number, userId?: string, limit?: number, offset?: number): Promise<ActivityWithRelations[]>;
  getActivity(id: number): Promise<ActivityWithRelations | undefined>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity>;
  deleteActivity(id: number): Promise<void>;

  // Pipeline stages operations
  getPipelineStages(): Promise<PipelineStage[]>;
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
    if (search) {
      conditions.push(ilike(contacts.name, `%${search}%`));
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
  async getDeals(stage?: string, limit = 50, offset = 0): Promise<DealWithRelations[]> {
    const query = db
      .select({
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

    if (stage) {
      query.where(eq(deals.stage, stage));
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

  async getDealsByStage(): Promise<{ stage: string; count: number; deals: DealWithRelations[] }[]> {
    const stages = ['prospecting', 'qualification', 'proposal', 'closing'];
    const result = [];

    for (const stage of stages) {
      const stageDeals = await this.getDeals(stage);
      result.push({
        stage,
        count: stageDeals.length,
        deals: stageDeals,
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
  async getPipelineStages(): Promise<PipelineStage[]> {
    return await db.select().from(pipelineStages).orderBy(pipelineStages.position);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [newStage] = await db
      .insert(pipelineStages)
      .values(stage)
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

  async deletePipelineStage(id: number): Promise<void> {
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  }

  async updateStagePositions(stages: Array<{ id: number; position: number }>): Promise<void> {
    for (const stage of stages) {
      await db
        .update(pipelineStages)
        .set({ position: stage.position, updatedAt: new Date() })
        .where(eq(pipelineStages.id, stage.id));
    }
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
    const [openDealsCount] = await db
      .select({ count: count() })
      .from(deals)
      .where(eq(deals.stage, 'prospecting'));

    // Calculate projected revenue from all open deals
    const openDeals = await db
      .select({ value: deals.value })
      .from(deals)
      .where(and(
        eq(deals.stage, 'prospecting'),
        eq(deals.stage, 'qualification'),
        eq(deals.stage, 'proposal'),
        eq(deals.stage, 'closing')
      ));

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
}

export const storage = new DatabaseStorage();
