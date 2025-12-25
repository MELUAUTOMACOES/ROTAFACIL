-- Migration: Adicionar campos de tempo nas ocorrências de rota
-- Adiciona horário aproximado e duração em minutos

ALTER TABLE route_occurrences 
ADD COLUMN approximate_time VARCHAR(5),
ADD COLUMN duration_minutes INTEGER;

-- Comentário explicativo
COMMENT ON COLUMN route_occurrences.approximate_time IS 'Horário aproximado da ocorrência em formato HH:mm';
COMMENT ON COLUMN route_occurrences.duration_minutes IS 'Tempo decorrente da ocorrência em minutos';
