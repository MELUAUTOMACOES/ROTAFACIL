-- ===================================================================
-- MIGRAÇÃO: NORMALIZAR ROLES EM MEMBERSHIPS (MAIÚSCULO → MINÚSCULO)
-- ===================================================================
-- Problema: Memberships antigas salvaram roles como "ADMIN", "OPERADOR", etc.
--           O frontend espera "admin", "operador", etc. (minúsculo)
-- ===================================================================

-- 1. Verificar estado atual (execute antes para ver o problema)
SELECT id, user_id, company_id, role
FROM memberships
WHERE role != LOWER(role);

-- 2. Normalizar roles para minúsculo
UPDATE memberships SET role = 'admin' WHERE role = 'ADMIN';
UPDATE memberships SET role = 'operador' WHERE role = 'OPERADOR';
UPDATE memberships SET role = 'user' WHERE role = 'ADMINISTRATIVO';
UPDATE memberships SET role = 'tecnico' WHERE role = 'TECNICO';
UPDATE memberships SET role = 'prestador' WHERE role = 'PRESTADOR';

-- 3. Garantir que qualquer outra variação seja normalizada
UPDATE memberships SET role = LOWER(role) WHERE role != LOWER(role);

-- 4. Verificar resultado (deve retornar 0 linhas)
SELECT id, user_id, company_id, role
FROM memberships
WHERE role != LOWER(role);

-- ===================================================================
-- FIM
-- ===================================================================
