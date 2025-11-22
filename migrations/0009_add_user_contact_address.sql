-- Migration: Add contact and address fields to users table
-- Created: 2025-01-16
-- Description: Adiciona campos de telefone e endereço completo para usuários

-- Adicionar campos de contato e endereço
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS estado TEXT;

-- Comentários para documentação
COMMENT ON COLUMN users.phone IS 'Telefone de contato do usuário';
COMMENT ON COLUMN users.cep IS 'CEP do endereço do usuário';
COMMENT ON COLUMN users.logradouro IS 'Logradouro (rua, avenida) do endereço';
COMMENT ON COLUMN users.numero IS 'Número do endereço';
COMMENT ON COLUMN users.complemento IS 'Complemento do endereço (apto, bloco, etc)';
COMMENT ON COLUMN users.bairro IS 'Bairro do endereço';
COMMENT ON COLUMN users.cidade IS 'Cidade do endereço';
COMMENT ON COLUMN users.estado IS 'Estado (UF) do endereço';
