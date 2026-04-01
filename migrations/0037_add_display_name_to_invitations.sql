-- Adicionar campo display_name à tabela invitations
-- Permite que o convite especifique um nome personalizado para o usuário na empresa
ALTER TABLE invitations ADD COLUMN display_name TEXT;

-- Comentário explicativo
COMMENT ON COLUMN invitations.display_name IS 'Nome personalizado que será usado quando o usuário aceitar o convite e a membership for criada';
