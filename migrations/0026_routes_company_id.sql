-- Migration 0026: Adicionar company_id à tabela routes (isolamento multi-tenant)
-- ============================================================

-- 1) Adicionar coluna company_id (nullable inicialmente para permitir fill)
ALTER TABLE routes ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id);

-- 2) Preencher company_id baseado no user_id → memberships (primeira membership ativa)
UPDATE routes r
SET company_id = sub.company_id
FROM (
  SELECT DISTINCT ON (m.user_id) m.user_id, m.company_id
  FROM memberships m
  WHERE m.is_active = true
  ORDER BY m.user_id, m.id ASC
) sub
WHERE r.user_id = sub.user_id
  AND r.company_id IS NULL;

-- 3) Diagnóstico: verificar se restaram routes sem company_id
-- SELECT id, user_id FROM routes WHERE company_id IS NULL;
-- Se houver, investigar manualmente antes de tornar NOT NULL.

-- 4) Tornar NOT NULL (só executar se o diagnóstico acima retornar 0 linhas)
-- Se houver rotas órfãs, comente esta linha e trate manualmente.
-- ALTER TABLE routes ALTER COLUMN company_id SET NOT NULL;

-- 5) Índice para performance de queries filtradas por company_id
CREATE INDEX IF NOT EXISTS idx_routes_company_id ON routes (company_id);

-- 6) Índice composto para listagem paginada (company_id + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_routes_company_created ON routes (company_id, created_at DESC);
