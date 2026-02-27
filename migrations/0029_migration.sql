-- Migration 0029: Add company_id to tracking_locations (telemetria multi-tenant segura)

BEGIN;

-- 1) Adiciona coluna + FK
ALTER TABLE tracking_locations
  ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- 2) Índices (telemetria costuma crescer rápido)
CREATE INDEX IF NOT EXISTS idx_tracking_locations_company_id
  ON tracking_locations(company_id);

CREATE INDEX IF NOT EXISTS idx_tracking_locations_company_created_at
  ON tracking_locations(company_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tracking_locations_company_route
  ON tracking_locations(company_id, route_id);

-- 3) Backfill primário: via route_id -> routes.company_id (mais correto)
UPDATE tracking_locations tl
SET company_id = r.company_id
FROM routes r
WHERE tl.route_id = r.id
  AND tl.company_id IS NULL;

-- 4) Backfill secundário (fallback): via user_id -> memberships (somente users com 1 company ativa)
WITH one_active AS (
  SELECT user_id, MIN(company_id) AS company_id
  FROM memberships
  WHERE is_active = true
  GROUP BY user_id
  HAVING COUNT(DISTINCT company_id) = 1
)
UPDATE tracking_locations tl
SET company_id = oa.company_id
FROM one_active oa
WHERE tl.user_id = oa.user_id
  AND tl.company_id IS NULL;

-- 5) Verificação (deixe comentado; você roda depois do COMMIT se quiser)
-- SELECT COUNT(*) FROM tracking_locations WHERE company_id IS NULL;

COMMIT;