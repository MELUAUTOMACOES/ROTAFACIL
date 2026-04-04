-- Migration: Criar tabela de endereços de clientes
-- Data: 2026-04-03
-- Descrição: Suporte a múltiplos endereços por cliente (até 5)
-- IMPORTANTE: Campos legados em clients (cep, logradouro, etc.) serão mantidos para compatibilidade temporária

-- Criar tabela de endereços de clientes
CREATE TABLE IF NOT EXISTS client_addresses (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Identificação do endereço
  label TEXT, -- "Matriz", "Filial 1", "Depósito", etc. (opcional)
  
  -- Endereço completo
  cep TEXT NOT NULL,
  logradouro TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL, -- UF (ex: PR, SP, RJ)
  
  -- Geocodificação (migrada de clients quando disponível)
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  
  -- Controle
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Isolamento multiempresa (DEVE ser igual ao clients.company_id)
  company_id INTEGER NOT NULL REFERENCES companies(id),
  
  -- Auditoria
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_client_addresses_client_id ON client_addresses(client_id);
CREATE INDEX idx_client_addresses_company_id ON client_addresses(company_id);

-- Constraint: apenas 1 endereço principal por cliente
-- Usando partial unique index (funciona mesmo com múltiplas linhas is_primary=false)
CREATE UNIQUE INDEX idx_one_primary_per_client ON client_addresses(client_id) WHERE is_primary = TRUE;

-- Comentários para documentação
COMMENT ON TABLE client_addresses IS 'Endereços de clientes - suporta até 5 endereços por cliente';
COMMENT ON COLUMN client_addresses.label IS 'Identificação opcional do endereço (ex: Matriz, Filial 1)';
COMMENT ON COLUMN client_addresses.is_primary IS 'Apenas um endereço pode ser principal por cliente';
COMMENT ON COLUMN client_addresses.company_id IS 'Isolamento multiempresa - deve ser igual ao company_id do cliente';
COMMENT ON COLUMN client_addresses.estado IS 'Sigla do estado (UF) - campo novo não existente na estrutura legada';
