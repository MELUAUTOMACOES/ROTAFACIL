-- Migration: Add fuel fields to vehicles, execution times to appointments, and fuel prices/goals to business_rules
-- Date: 2024-12-24

-- 1. Add fuel-related fields to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type TEXT NOT NULL DEFAULT 'gasolina';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_consumption DECIMAL(5, 2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tank_capacity INTEGER;

-- 2. Add execution time fields to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS execution_finished_at TIMESTAMP;

-- 3. Add fuel prices to business_rules table
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS preco_combustivel_gasolina DECIMAL(6, 3) DEFAULT 5.500;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS preco_combustivel_etanol DECIMAL(6, 3) DEFAULT 3.800;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS preco_combustivel_diesel_s500 DECIMAL(6, 3) DEFAULT 5.200;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS preco_combustivel_diesel_s10 DECIMAL(6, 3) DEFAULT 5.800;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS preco_combustivel_eletrico DECIMAL(6, 3) DEFAULT 0.800;

-- 4. Add operational goals to business_rules table
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS meta_variacao_tempo_servico INTEGER DEFAULT 15;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS meta_utilizacao_diaria INTEGER DEFAULT 80;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS sla_horas_pendencia INTEGER DEFAULT 48;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_execution_started ON appointments(execution_started_at) WHERE execution_started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_execution_finished ON appointments(execution_finished_at) WHERE execution_finished_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel_type ON vehicles(fuel_type);
