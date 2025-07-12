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
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
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
  let retries = 3;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('Database connection test successful');
      return true;
    } catch (error) {
      console.error(`Database connection test failed (${4-retries}/3):`, error.message);
      retries--;
      if (retries > 0) {
        console.log('Retrying in 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  console.log('Continuing without database connection...');
  return false;
};