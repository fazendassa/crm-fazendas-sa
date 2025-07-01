import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("vendedor"), // 'admin', 'gestor', 'vendedor', 'financeiro', 'externo'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  sector: varchar("sector"),
  location: varchar("location"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  position: varchar("position"),
  companyId: integer("company_id").references(() => companies.id),
  pipelineId: integer("pipeline_id").references(() => pipelines.id),
  tags: text("tags").array().default([]),
  status: varchar("status").notNull().default("active"), // 'active', 'inactive', 'prospect'
  source: varchar("source").default("manual"), // 'manual', 'import', 'api'
  // Address fields
  street: varchar("street"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  country: varchar("country").default("Brasil"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  value: decimal("value", { precision: 12, scale: 2 }),
  stage: varchar("stage").notNull().default("prospecção"),
  pipelineId: integer("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  expectedCloseDate: timestamp("expected_close_date"),
  contactId: integer("contact_id").references(() => contacts.id),
  companyId: integer("company_id").references(() => companies.id),
  ownerId: varchar("owner_id").references(() => users.id, { onDelete: "set null" }), // Vendedor responsável
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: varchar("type").notNull(), // 'call', 'email', 'meeting', 'note', 'task'
  title: varchar("title").notNull(),
  description: text("description"),
  contactId: integer("contact_id").references(() => contacts.id),
  dealId: integer("deal_id").references(() => deals.id),
  companyId: integer("company_id").references(() => companies.id),
  userId: varchar("user_id").references(() => users.id),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pipelineStages = pgTable("pipeline_stages", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  position: integer("position").notNull(),
  color: varchar("color", { length: 20 }).default("#3b82f6"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  contacts: many(contacts),
  deals: many(deals),
  activities: many(activities),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  pipeline: one(pipelines, {
    fields: [contacts.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
  activities: many(activities),
}));

export const pipelinesRelations = relations(pipelines, ({ many }) => ({
  deals: many(deals),
  stages: many(pipelineStages),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [activities.dealId],
    references: [deals.id],
  }),
  company: one(companies, {
    fields: [activities.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  activities: many(activities),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [pipelineStages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
}));

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expectedCloseDate: z.string().optional().nullable().transform((val) => {
    if (!val) return null;
    return new Date(val);
  }),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPipelineSchema = createInsertSchema(pipelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;

// Extended types with relations
export type ContactWithCompany = Contact & {
  company?: Company;
};

export type DealWithRelations = Deal & {
  contact?: Contact;
  company?: Company;
};

export type ActivityWithRelations = Activity & {
  contact?: Contact;
  deal?: Deal;
  company?: Company;
  user?: User;
};

// ActiveCampaign Integration Configuration
export const activeCampaignConfigs = pgTable("activecampaign_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  activeCampaignApiUrl: text("activecampaign_api_url").notNull(),
  activeCampaignApiKey: text("activecampaign_api_key").notNull(),
  webhookSecret: text("webhook_secret").notNull(),
  pipelineId: integer("pipeline_id").references(() => pipelines.id).notNull(),
  defaultTags: jsonb("default_tags").$type<string[]>().default([]),
  fieldMapping: jsonb("field_mapping").$type<Record<string, string>>().default({}),
  webhookType: text("webhook_type").default("contact"), // contact or deal
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ActiveCampaign Webhook Logs for debugging
export const activeCampaignWebhookLogs = pgTable("activecampaign_webhook_logs", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").references(() => activeCampaignConfigs.id),
  webhookData: jsonb("webhook_data").$type<Record<string, any>>().notNull(),
  contactId: integer("contact_id").references(() => contacts.id),
  dealId: integer("deal_id").references(() => deals.id),
  status: text("status").notNull(), // success, error, warning
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at").defaultNow(),
});

// Relations for ActiveCampaign integration
export const activeCampaignConfigsRelations = relations(activeCampaignConfigs, ({ one, many }) => ({
  pipeline: one(pipelines, {
    fields: [activeCampaignConfigs.pipelineId],
    references: [pipelines.id],
  }),
  webhookLogs: many(activeCampaignWebhookLogs),
}));

export const activeCampaignWebhookLogsRelations = relations(activeCampaignWebhookLogs, ({ one }) => ({
  config: one(activeCampaignConfigs, {
    fields: [activeCampaignWebhookLogs.configId],
    references: [activeCampaignConfigs.id],
  }),
  contact: one(contacts, {
    fields: [activeCampaignWebhookLogs.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [activeCampaignWebhookLogs.dealId],
    references: [deals.id],
  }),
}));

// Insert schemas for ActiveCampaign
export const insertActiveCampaignConfigSchema = createInsertSchema(activeCampaignConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertActiveCampaignConfig = z.infer<typeof insertActiveCampaignConfigSchema>;
export type ActiveCampaignConfig = typeof activeCampaignConfigs.$inferSelect;

export const insertActiveCampaignWebhookLogSchema = createInsertSchema(activeCampaignWebhookLogs).omit({
  id: true,
  processedAt: true,
});
export type InsertActiveCampaignWebhookLog = z.infer<typeof insertActiveCampaignWebhookLogSchema>;
export type ActiveCampaignWebhookLog = typeof activeCampaignWebhookLogs.$inferSelect;

export type ActiveCampaignConfigWithRelations = ActiveCampaignConfig & {
  pipeline?: Pipeline | null;
};
