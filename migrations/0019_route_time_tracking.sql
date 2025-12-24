-- Migration 0019: Route Time Tracking
-- Adiciona campos para rastreamento de tempo na tela de prestadores

-- Campos na tabela routes para rastrear início/fim da rota
ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_started_at TIMESTAMP;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_finished_at TIMESTAMP;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS route_end_location VARCHAR(20);

-- Comentários para documentação
COMMENT ON COLUMN routes.route_started_at IS 'Quando o prestador clicou em Iniciar Rota';
COMMENT ON COLUMN routes.route_finished_at IS 'Quando o prestador clicou em Fechar Romaneio';
COMMENT ON COLUMN routes.route_end_location IS 'last_client ou company_home - onde finalizou o dia';

-- Índice para buscar rotas por status de execução
CREATE INDEX IF NOT EXISTS idx_routes_started_at ON routes(route_started_at) WHERE route_started_at IS NOT NULL;
