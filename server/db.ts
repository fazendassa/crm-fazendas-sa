import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pooled connection with proper timeout settings
const poolUrl = process.env.DATABASE_URL.replace('.us-east-2', '-pooler.us-east-2');

export const pool = new Pool({ 
  connectionString: poolUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

export const db = drizzle({ client: pool, schema });