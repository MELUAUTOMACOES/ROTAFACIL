-- ============================================================
-- Migration: Performance Indexes for Supabase
-- Run this file directly in Supabase SQL Editor
-- ============================================================

-- APPOINTMENTS: Indexes críticos para queries de agendamentos
-- Index composto para filtrar por usuário e data (query mais frequente)
CREATE INDEX IF NOT EXISTS idx_appointments_user_scheduled ON appointments (user_id, scheduled_date);

-- Index para filtrar por usuário e status
CREATE INDEX IF NOT EXISTS idx_appointments_user_status ON appointments (user_id, status);

-- Index para ordenação por data
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON appointments (scheduled_date DESC);

-- Index para filtrar por cliente
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments (client_id);

-- ============================================================
-- ROUTES: Indexes para listagem e filtro de rotas
-- ============================================================

-- Index composto para filtrar por usuário e status
CREATE INDEX IF NOT EXISTS idx_routes_user_status ON routes (user_id, status);

-- Index para filtrar por usuário e data
CREATE INDEX IF NOT EXISTS idx_routes_user_date ON routes (user_id, date DESC);

-- Index para status (já pode existir)
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes (status);

-- ============================================================
-- ROUTE_STOPS: Indexes para joins com agendamentos
-- ============================================================

-- Index para buscar paradas por rota (ordenado)
CREATE INDEX IF NOT EXISTS idx_route_stops_route_order ON route_stops (route_id, "order");

-- Index para buscar por appointment_numeric_id (critical para validação)
CREATE INDEX IF NOT EXISTS idx_route_stops_appointment_numeric_id ON route_stops (appointment_numeric_id);

-- ============================================================
-- CLIENTS: Indexes para busca de clientes
-- ============================================================

-- Index por usuário
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients (user_id);

-- Index para busca por nome (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON clients (LOWER(name));

-- Index para busca por CPF
CREATE INDEX IF NOT EXISTS idx_clients_cpf ON clients (cpf);

-- ============================================================
-- TECHNICIANS & TEAMS: Indexes para listagem
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_technicians_user_id ON technicians (user_id);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams (user_id);

-- ============================================================
-- SERVIÇOS: Index para listagem
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_services_user_id ON services (user_id);

-- ============================================================
-- ANALYZE: Atualizar estatísticas do planner
-- ============================================================

ANALYZE appointments;
ANALYZE routes;
ANALYZE route_stops;
ANALYZE clients;
ANALYZE technicians;
ANALYZE teams;
ANALYZE services;

-- ============================================================
-- VERIFICAÇÃO: Listar indexes criados
-- ============================================================
-- Execute após aplicar para verificar:
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('appointments', 'routes', 'route_stops', 'clients')
-- ORDER BY tablename, indexname;
