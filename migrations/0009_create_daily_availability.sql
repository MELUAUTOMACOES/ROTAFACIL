-- Migration: Create daily_availability table
-- Armazena disponibilidade calculada por dia/responsável para consultas rápidas

CREATE TABLE IF NOT EXISTS "daily_availability" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "date" TIMESTAMP NOT NULL,
  "responsible_type" VARCHAR(16) NOT NULL,
  "responsible_id" INTEGER NOT NULL,
  "total_minutes" INTEGER NOT NULL DEFAULT 0,
  "used_minutes" INTEGER NOT NULL DEFAULT 0,
  "available_minutes" INTEGER NOT NULL DEFAULT 0,
  "appointment_count" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(16) NOT NULL DEFAULT 'available',
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS "idx_daily_availability_user_date" ON "daily_availability"("user_id", "date");
CREATE INDEX IF NOT EXISTS "idx_daily_availability_responsible" ON "daily_availability"("responsible_type", "responsible_id");
CREATE INDEX IF NOT EXISTS "idx_daily_availability_date" ON "daily_availability"("date");

-- Índice único composto para evitar duplicatas
CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_availability_unique" 
  ON "daily_availability"("user_id", "date", "responsible_type", "responsible_id");

-- Comentários
COMMENT ON TABLE "daily_availability" IS 'Armazena disponibilidade calculada por dia/responsável para consultas rápidas';
COMMENT ON COLUMN "daily_availability"."responsible_type" IS 'Tipo do responsável: technician ou team';
COMMENT ON COLUMN "daily_availability"."responsible_id" IS 'ID do técnico ou equipe';
COMMENT ON COLUMN "daily_availability"."status" IS 'Status: available, partial, full, exceeded';
