-- ============================================================
-- Migration: Índices Adicionais para Performance de Agendamentos
-- Execute diretamente no Supabase SQL Editor
-- ============================================================

-- 🚀 Índice composto otimizado para query principal com filtro de data DESC
-- Usado pelo endpoint GET /api/appointments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_user_date_desc 
  ON appointments (user_id, scheduled_date DESC);

-- 🚀 Índice para o batch lookup de route_stops
-- Usado na segunda etapa da query otimizada
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_route_stops_appt_route 
  ON route_stops (appointment_numeric_id, route_id);

-- 🚀 Índice parcial para rotas confirmadas/finalizadas (mais seletivo)
-- Melhora o JOIN com routes na segunda query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routes_confirmed_finalized 
  ON routes (id) WHERE status IN ('confirmado', 'finalizado');

-- Atualizar estatísticas após criar índices
ANALYZE appointments;
ANALYZE route_stops;
ANALYZE routes;
