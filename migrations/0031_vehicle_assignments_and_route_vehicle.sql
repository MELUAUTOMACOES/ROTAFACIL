-- Migration 0031: Sistema de permissões de veículos + registro de veículo usado no romaneio
-- Permite que múltiplos técnicos/equipes sejam autorizados a usar um veículo
-- Registra qual veículo foi usado em cada rota/romaneio

-- =============================================================================
-- 1) Criar tabela de permissões/autorizações de veículos
-- =============================================================================
CREATE TABLE IF NOT EXISTS vehicle_assignments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  
  -- Exatamente UM entre technician_id ou team_id deve ser preenchido
  technician_id INTEGER REFERENCES technicians(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints para garantir integridade
  CONSTRAINT vehicle_assignment_check CHECK (
    (technician_id IS NOT NULL AND team_id IS NULL) OR
    (technician_id IS NULL AND team_id IS NOT NULL)
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_company_id ON vehicle_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle_id ON vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_technician_id ON vehicle_assignments(technician_id) WHERE technician_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_team_id ON vehicle_assignments(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_active ON vehicle_assignments(vehicle_id, is_active) WHERE is_active = true;

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_company_vehicle ON vehicle_assignments(company_id, vehicle_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_company_tech ON vehicle_assignments(company_id, technician_id, is_active) WHERE technician_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_company_team ON vehicle_assignments(company_id, team_id, is_active) WHERE team_id IS NOT NULL;

-- Unique constraints para evitar duplicatas
-- (somente para registros ativos, permitindo histórico)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_assignments_unique_tech ON vehicle_assignments(vehicle_id, technician_id) 
  WHERE technician_id IS NOT NULL AND is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_assignments_unique_team ON vehicle_assignments(vehicle_id, team_id) 
  WHERE team_id IS NOT NULL AND is_active = true;

-- =============================================================================
-- 2) Adicionar coluna vehicle_id na tabela routes
-- =============================================================================
ALTER TABLE routes ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL;

-- Índice para busca por veículo usado
CREATE INDEX IF NOT EXISTS idx_routes_vehicle_id ON routes(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routes_company_vehicle ON routes(company_id, vehicle_id) WHERE vehicle_id IS NOT NULL;

-- =============================================================================
-- 3) BACKFILL: Migrar autorizações existentes de vehicles para vehicle_assignments
-- =============================================================================
-- Para cada veículo que tem technician_id, criar uma autorização
INSERT INTO vehicle_assignments (company_id, user_id, vehicle_id, technician_id, is_active, created_at)
SELECT 
  COALESCE(v.company_id, m.company_id) as company_id,
  v.user_id,
  v.id as vehicle_id,
  v.technician_id,
  true as is_active,
  v.created_at
FROM vehicles v
LEFT JOIN LATERAL (
  SELECT company_id 
  FROM memberships 
  WHERE user_id = v.user_id AND is_active = true 
  ORDER BY id 
  LIMIT 1
) m ON true
WHERE v.technician_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Para cada veículo que tem team_id, criar uma autorização
INSERT INTO vehicle_assignments (company_id, user_id, vehicle_id, team_id, is_active, created_at)
SELECT 
  COALESCE(v.company_id, m.company_id) as company_id,
  v.user_id,
  v.id as vehicle_id,
  v.team_id,
  true as is_active,
  v.created_at
FROM vehicles v
LEFT JOIN LATERAL (
  SELECT company_id 
  FROM memberships 
  WHERE user_id = v.user_id AND is_active = true 
  ORDER BY id 
  LIMIT 1
) m ON true
WHERE v.team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMENTÁRIOS / DOCUMENTAÇÃO
-- =============================================================================
COMMENT ON TABLE vehicle_assignments IS 'Permissões de uso de veículos por técnicos e equipes (multi-tenant)';
COMMENT ON COLUMN vehicle_assignments.technician_id IS 'Técnico autorizado (exclusivo com team_id)';
COMMENT ON COLUMN vehicle_assignments.team_id IS 'Equipe autorizada (exclusivo com technician_id)';
COMMENT ON COLUMN vehicle_assignments.is_active IS 'Autorização ativa (permite histórico ao desativar)';

COMMENT ON COLUMN routes.vehicle_id IS 'Veículo utilizado neste romaneio/rota (registro histórico)';
