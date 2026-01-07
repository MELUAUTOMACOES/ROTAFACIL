-- Migration: Add OSRM distance fields to business_rules
-- Separates real route distance (OSRM) from approximate distance (Haversine)

-- Add new fields for separated distance calculations
ALTER TABLE business_rules 
ADD COLUMN IF NOT EXISTS distancia_maxima_entre_pontos_osrm DECIMAL(8,2) DEFAULT 50.00 NOT NULL,
ADD COLUMN IF NOT EXISTS distancia_maxima_entre_pontos_haversine DECIMAL(8,2) DEFAULT 40.00 NOT NULL;

-- Migrate existing data: OSRM uses current value, Haversine uses 80% of current
UPDATE business_rules 
SET distancia_maxima_entre_pontos_osrm = COALESCE(distancia_maxima_entre_pontos, 50.00),
    distancia_maxima_entre_pontos_haversine = COALESCE(distancia_maxima_entre_pontos * 0.8, 40.00);

-- Add comment explaining field usage
COMMENT ON COLUMN business_rules.distancia_maxima_entre_pontos_osrm IS 'Distância máxima real (OSRM) entre pontos consecutivos em km';
COMMENT ON COLUMN business_rules.distancia_maxima_entre_pontos_haversine IS 'Distância máxima aproximada (Haversine) para pré-filtro rápido em km';
COMMENT ON COLUMN business_rules.minutos_entre_paradas IS 'DEPRECATED - não utilizado em cálculos';
