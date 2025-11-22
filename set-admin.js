// Script para configurar usuário como administrador
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function setAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Conectando ao banco de dados...');
    
    // Atualizar usuário para admin
    const updateResult = await pool.query(`
      UPDATE users 
      SET role = 'admin', 
          email_verified = true,
          require_password_change = false
      WHERE email = 'lucaspmastaler@gmail.com'
      RETURNING id, name, email, role, email_verified;
    `);

    if (updateResult.rows.length > 0) {
      console.log('✅ Usuário atualizado com sucesso!');
      console.log('');
      console.log('📋 Dados atualizados:');
      console.log('-------------------');
      console.table(updateResult.rows);
      console.log('');
      console.log('⚠️  IMPORTANTE: Faça LOGOUT e LOGIN novamente para ver o menu de Gestão de Usuários!');
    } else {
      console.log('❌ Usuário não encontrado com este email.');
      console.log('');
      console.log('🔍 Listando todos os usuários:');
      const allUsers = await pool.query('SELECT id, name, email, role FROM users;');
      console.table(allUsers.rows);
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar:', error.message);
  } finally {
    await pool.end();
  }
}

setAdmin();
