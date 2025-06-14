import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// 🗄️ CONFIGURAÇÃO OBRIGATÓRIA: DATABASE_URL deve estar definido nas variáveis de ambiente
// Esta é a string de conexão completa com seu banco PostgreSQL
// Formato: postgresql://usuario:senha@host:porta/nome_do_banco
// Exemplo: postgresql://user:password@localhost:5432/rotafacil
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set in environment variables. This should be your PostgreSQL connection string."
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
