-- Migration: Add user management fields for LGPD compliance
-- Created: 2025-01-16
-- Description: Adiciona campos para gestão de usuários, validação de email e controle de primeira senha

-- Adicionar campos de gestão de usuários
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- Atualizar usuários existentes para terem email verificado e role admin
UPDATE users SET 
  email_verified = TRUE,
  role = 'admin',
  is_active = TRUE
WHERE id = 1;

-- Comentários para documentação
COMMENT ON COLUMN users.role IS 'Perfil do usuário: admin ou user';
COMMENT ON COLUMN users.email_verified IS 'Indica se o email foi verificado';
COMMENT ON COLUMN users.email_verification_token IS 'Token para verificação de email';
COMMENT ON COLUMN users.email_verification_expiry IS 'Data de expiração do token de verificação';
COMMENT ON COLUMN users.require_password_change IS 'Indica se o usuário precisa trocar a senha (LGPD)';
COMMENT ON COLUMN users.is_active IS 'Indica se o usuário está ativo';
COMMENT ON COLUMN users.last_login_at IS 'Data e hora do último login';
COMMENT ON COLUMN users.created_by IS 'ID do administrador que criou o usuário (rastreabilidade LGPD)';
