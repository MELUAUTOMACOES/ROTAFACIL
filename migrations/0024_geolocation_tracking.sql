-- Migration: Geolocalização
-- Cria tabela tracking_locations e adiciona campos de localização em routes e appointments

-- Tabela de rastreamento
CREATE TABLE IF NOT EXISTS "tracking_locations" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users" ("id"),
  "route_id" uuid REFERENCES "routes" ("id"),
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "timestamp" timestamp NOT NULL DEFAULT now(),
  "accuracy" double precision,
  "battery_level" integer,
  "speed" double precision,
  "heading" double precision,
  "provider_id" integer,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Campos JSONB de localização em appointments
ALTER TABLE "appointments" 
ADD COLUMN "execution_start_location" jsonb,
ADD COLUMN "execution_end_location" jsonb;

-- Campos JSONB de localização em routes
ALTER TABLE "routes" 
ADD COLUMN "start_location_data" jsonb,
ADD COLUMN "end_location_data" jsonb;

-- Índices para performance
CREATE INDEX IF NOT EXISTS "idx_tracking_route_id" ON "tracking_locations" ("route_id");
CREATE INDEX IF NOT EXISTS "idx_tracking_user_timestamp" ON "tracking_locations" ("user_id", "timestamp");
