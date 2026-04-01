-- Adicionar campo display_name à tabela memberships
-- Permite que cada empresa defina um nome específico para o usuário
ALTER TABLE memberships ADD COLUMN display_name TEXT;

-- Criar índice para melhorar performance de buscas
CREATE INDEX idx_memberships_display_name ON memberships(display_name) WHERE display_name IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN memberships.display_name IS 'Nome de exibição do usuário específico para esta empresa. Se NULL, usa users.name';
