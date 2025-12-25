import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set in environment variables. This should be your PostgreSQL connection string."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 🚀 Otimizações para Supabase remoto
  max: 10,                           // Máximo de conexões no pool
  idleTimeoutMillis: 30000,          // 30s antes de liberar conexão ociosa
  connectionTimeoutMillis: 5000,     // 5s timeout para nova conexão
  keepAlive: true,                   // Manter conexões ativas
  keepAliveInitialDelayMillis: 10000, // Delay antes do primeiro keepalive
});
export const db = drizzle(pool, { schema });
