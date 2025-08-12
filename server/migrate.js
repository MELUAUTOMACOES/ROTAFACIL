// Script temporário para executar migração display_number
import dotenv from "dotenv";
dotenv.config();

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    const sql = `
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM routes
        WHERE display_number IS NULL OR display_number = 0
      )
      UPDATE routes r 
      SET display_number = n.rn 
      FROM numbered n 
      WHERE n.id = r.id;
    `;
    
    const result = await pool.query(sql);
    console.log('✅ Migração executada com sucesso');
    console.log('Registros atualizados:', result.rowCount);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await pool.end();
  }
}

migrate();