-- Migration: Add password_changed_at field to users table
-- Created: 2025-11-20
-- Description: Adiciona campo para rastrear quando a senha foi alterada (para invalidar tokens JWT antigos)

-- Adicionar campo de data de alteração de senha
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP;

-- Comentário para documentação
COMMENT ON COLUMN users.password_changed_at IS 'Data da última alteração de senha (usado para invalidar tokens JWT antigos)';
