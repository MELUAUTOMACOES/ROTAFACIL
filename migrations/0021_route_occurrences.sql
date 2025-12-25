-- Migration: Criar tabela route_occurrences
-- Created at: 2025-12-25

CREATE TABLE IF NOT EXISTS route_occurrences (
    id SERIAL PRIMARY KEY,
    route_id UUID NOT NULL REFERENCES routes(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(32) NOT NULL, -- almoco, problema_tecnico, abastecimento, outro
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índice por rota para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_route_occurrences_route_id ON route_occurrences(route_id);
