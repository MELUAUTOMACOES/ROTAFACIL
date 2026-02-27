-- Migration 0028: Adicionar company_id às tabelas de domínio que faltavam (auditoria multi-tenant)
-- Tabelas afetadas: date_restrictions, daily_availability, access_schedules, team_members, 
--                   vehicle_documents, vehicle_maintenances, checklists (old/deprecated)

-- 1) date_restrictions
ALTER TABLE date_restrictions ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_date_restrictions_company_id ON date_restrictions(company_id);

-- 2) daily_availability
ALTER TABLE daily_availability ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_daily_availability_company_id ON daily_availability(company_id);

-- 3) access_schedules
ALTER TABLE access_schedules ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_access_schedules_company_id ON access_schedules(company_id);

-- 4) team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_team_members_company_id ON team_members(company_id);

-- 5) vehicle_documents
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_company_id ON vehicle_documents(company_id);

-- 6) vehicle_maintenances
ALTER TABLE vehicle_maintenances ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenances_company_id ON vehicle_maintenances(company_id);

-- 7) checklists (old/deprecated - mantido para compatibilidade)
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_checklists_company_id ON checklists(company_id);

-- =============================================================================
-- BACKFILL: Preencher company_id via user_id → memberships (primeira membership ativa)
-- =============================================================================
UPDATE date_restrictions SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE date_restrictions.user_id = m.user_id AND date_restrictions.company_id IS NULL;

UPDATE daily_availability SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE daily_availability.user_id = m.user_id AND daily_availability.company_id IS NULL;

UPDATE access_schedules SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE access_schedules.user_id = m.user_id AND access_schedules.company_id IS NULL;

UPDATE team_members SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE team_members.user_id = m.user_id AND team_members.company_id IS NULL;

UPDATE vehicle_documents SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE vehicle_documents.user_id = m.user_id AND vehicle_documents.company_id IS NULL;

UPDATE vehicle_maintenances SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE vehicle_maintenances.user_id = m.user_id AND vehicle_maintenances.company_id IS NULL;

UPDATE checklists SET company_id = m.company_id
FROM (SELECT DISTINCT ON (user_id) user_id, company_id FROM memberships WHERE is_active = true ORDER BY user_id, id) m
WHERE checklists.user_id = m.user_id AND checklists.company_id IS NULL;

-- =============================================================================
-- ÍNDICES compostos úteis para performance multi-tenant
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_date_restrictions_company_date ON date_restrictions(company_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_availability_company_date ON daily_availability(company_id, date);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenances_company_created ON vehicle_maintenances(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_company_vehicle ON vehicle_documents(company_id, vehicle_id);
