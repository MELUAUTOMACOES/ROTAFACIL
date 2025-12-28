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
  connectionTimeoutMillis: 10000,    // 10s timeout para nova conexão (aumentado de 5s)
  keepAlive: true,                   // Manter conexões ativas
  keepAliveInitialDelayMillis: 10000, // Delay antes do primeiro keepalive
  // 🔄 Configurações de resiliência
  statement_timeout: 30000,          // 30s timeout para statements
  query_timeout: 30000,              // 30s timeout para queries
});
export const db = drizzle(pool, { schema });
