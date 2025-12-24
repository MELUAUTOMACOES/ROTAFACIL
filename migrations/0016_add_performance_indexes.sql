-- Migration: Add indexes for appointments query optimization
-- Run this file with: psql -d DATABASE_URL -f 0016_add_performance_indexes.sql

CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments (user_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_appointment_numeric_id ON route_stops (appointment_numeric_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops (route_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes (status);
CREATE INDEX IF NOT EXISTS idx_routes_id_status ON routes (id, status);
