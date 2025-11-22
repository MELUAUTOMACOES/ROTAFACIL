-- Migration: Add password reset fields to users table
-- Created: 2025-11-20
-- Description: Adiciona campos para token de recuperação de senha

-- Adicionar campos de recuperação de senha
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expiry TIMESTAMP;

-- Comentários para documentação
COMMENT ON COLUMN users.password_reset_token IS 'Token para recuperação de senha (válido por 1 hora)';
COMMENT ON COLUMN users.password_reset_expiry IS 'Data de expiração do token de recuperação de senha';
