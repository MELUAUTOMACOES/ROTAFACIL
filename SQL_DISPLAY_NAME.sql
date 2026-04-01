-- ===================================================================
-- MIGRAÇÃO: ADICIONAR DISPLAY_NAME (NOME POR EMPRESA)
-- ===================================================================
-- Data: 2026-03-31
-- Objetivo: Permitir que cada empresa defina um nome específico para
--           o usuário, diferente do nome global em users.name
-- ===================================================================

-- 1. Adicionar campo display_name à tabela memberships
ALTER TABLE memberships ADD COLUMN display_name TEXT;

-- 2. Criar índice para melhorar performance de buscas
CREATE INDEX idx_memberships_display_name ON memberships(display_name) 
WHERE display_name IS NOT NULL;

-- 3. Comentário explicativo para memberships
COMMENT ON COLUMN memberships.display_name IS 
'Nome de exibição do usuário específico para esta empresa. Se NULL, usa users.name';

-- 4. Adicionar campo display_name à tabela invitations
ALTER TABLE invitations ADD COLUMN display_name TEXT;

-- 5. Comentário explicativo para invitations
COMMENT ON COLUMN invitations.display_name IS 
'Nome personalizado que será usado quando o usuário aceitar o convite e a membership for criada';

-- ===================================================================
-- VERIFICAÇÃO
-- ===================================================================
-- Executar após a migração para confirmar:

-- Verificar que as colunas foram criadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('memberships', 'invitations') 
AND column_name = 'display_name';

-- Verificar índice criado
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'memberships' 
AND indexname = 'idx_memberships_display_name';

-- ===================================================================
-- EXEMPLO DE USO
-- ===================================================================

-- Criar convite com nome personalizado:
-- INSERT INTO invitations (company_id, email, role, display_name, token, expires_at, invited_by)
-- VALUES (1, 'usuario@email.com', 'OPERADOR', 'João - Empresa A', 'token123...', NOW() + INTERVAL '7 days', 1);

-- Ao aceitar convite, a membership será criada com display_name:
-- INSERT INTO memberships (user_id, company_id, role, display_name)
-- VALUES (26, 1, 'OPERADOR', 'João - Empresa A');

-- Listar usuários mostrando nome específico da empresa:
-- SELECT 
--   u.id,
--   COALESCE(m.display_name, u.name) as nome_exibicao,
--   m.role,
--   c.name as empresa
-- FROM memberships m
-- JOIN users u ON u.id = m.user_id
-- JOIN companies c ON c.id = m.company_id
-- WHERE m.company_id = 1;

-- ===================================================================
-- FIM DA MIGRAÇÃO
-- ===================================================================
