-- SQL Script para criação da tabela 'leads'
-- Arquivo gerado para ser executado manualmente no editor de SQL do PostgreSQL

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  industry TEXT NOT NULL,
  other_industry TEXT,
  employee_count INTEGER NOT NULL,
  technician_count INTEGER NOT NULL,
  vehicle_count INTEGER NOT NULL,
  deliveries_per_day INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
