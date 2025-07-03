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

// Configure pooled connection with proper timeout settings and retry logic
const poolUrl = process.env.DATABASE_URL.replace('.us-east-2', '-pooler.us-east-2');

export const pool = new Pool({ 
  connectionString: poolUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  // Add retry configuration
  allowExitOnIdle: true,
  // Handle reconnection automatically
  statement_timeout: 0,
  query_timeout: 0,
});

// Add error handler for the pool
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
  // Don't exit the process, let it retry
});

// Add connection handler to log successful connections
pool.on('connect', () => {
  console.log('PostgreSQL pool connected successfully');
});

export const db = drizzle({ client: pool, schema });

// Test the connection and retry if needed
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection test successful');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
};