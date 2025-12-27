-- Migration: Criar tabela fuel_records para rastreamento de abastecimentos
-- Data: 2025-12-26

CREATE TABLE IF NOT EXISTS fuel_records (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    occurrence_id INTEGER REFERENCES route_occurrences(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    company_id INTEGER REFERENCES companies(id),
    
    -- Dados do abastecimento
    fuel_date TIMESTAMP NOT NULL DEFAULT NOW(),
    fuel_type VARCHAR(32) NOT NULL, -- gasolina, etanol, diesel_s500, diesel_s10, eletrico
    liters DECIMAL(10, 3) NOT NULL, -- Litros abastecidos (ex: 45.500)
    price_per_liter DECIMAL(8, 4) NOT NULL, -- Preço por litro (ex: 5.8990)
    total_cost DECIMAL(12, 2) NOT NULL, -- Valor total
    
    -- Dados opcionais para cálculo de autonomia
    odometer_km INTEGER, -- Quilometragem atual do veículo
    notes TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fuel_records_vehicle_id ON fuel_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_user_id ON fuel_records(user_id);
CREATE INDEX IF NOT EXISTS idx_fuel_records_fuel_date ON fuel_records(fuel_date);
CREATE INDEX IF NOT EXISTS idx_fuel_records_company_id ON fuel_records(company_id);

-- Comentários
COMMENT ON TABLE fuel_records IS 'Registros de abastecimento de veículos da frota';
COMMENT ON COLUMN fuel_records.liters IS 'Quantidade de litros abastecidos';
COMMENT ON COLUMN fuel_records.price_per_liter IS 'Preço pago por litro do combustível';
COMMENT ON COLUMN fuel_records.total_cost IS 'Valor total pago no abastecimento';
COMMENT ON COLUMN fuel_records.odometer_km IS 'Quilometragem do veículo no momento do abastecimento';
