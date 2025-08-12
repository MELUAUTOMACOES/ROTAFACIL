-- Migração para adicionar e popular display_number na tabela routes
-- Como a tabela routes não tem user_id, usamos ordenação global

-- Atualizar registros existentes com numeração sequencial
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM routes
  WHERE display_number IS NULL OR display_number = 0
)
UPDATE routes r 
SET display_number = n.rn 
FROM numbered n 
WHERE n.id = r.id;