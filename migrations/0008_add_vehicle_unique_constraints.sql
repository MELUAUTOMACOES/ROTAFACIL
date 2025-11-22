-- Migration: Adicionar constraints UNIQUE para garantir 1 veículo por técnico/equipe
-- Data: 2025-01-15
-- Descrição: Garante que apenas 1 veículo pode estar vinculado a um técnico/equipe

-- Primeiro, limpar possíveis duplicatas existentes (mantém apenas o veículo mais recente de cada técnico/equipe)
-- Para técnicos
WITH duplicates_tech AS (
  SELECT 
    technician_id,
    MAX(id) as keep_id
  FROM vehicles
  WHERE technician_id IS NOT NULL
  GROUP BY technician_id
  HAVING COUNT(*) > 1
)
DELETE FROM vehicles v
WHERE v.technician_id IN (SELECT technician_id FROM duplicates_tech)
  AND v.id NOT IN (SELECT keep_id FROM duplicates_tech);

-- Para equipes
WITH duplicates_team AS (
  SELECT 
    team_id,
    MAX(id) as keep_id
  FROM vehicles
  WHERE team_id IS NOT NULL
  GROUP BY team_id
  HAVING COUNT(*) > 1
)
DELETE FROM vehicles v
WHERE v.team_id IN (SELECT team_id FROM duplicates_team)
  AND v.id NOT IN (SELECT keep_id FROM duplicates_team);

-- Adicionar constraint UNIQUE para technician_id (permitindo NULL)
-- PostgreSQL ignora NULL em UNIQUE constraints, então múltiplos NULLs são permitidos
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_technician_id_unique 
  ON vehicles(technician_id) 
  WHERE technician_id IS NOT NULL;

-- Adicionar constraint UNIQUE para team_id (permitindo NULL)
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_team_id_unique 
  ON vehicles(team_id) 
  WHERE team_id IS NOT NULL;
