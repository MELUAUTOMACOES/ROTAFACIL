ALTER TABLE "business_rules"
  ADD COLUMN IF NOT EXISTS "distancia_maxima_atendida" numeric(8,2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS "distancia_maxima_entre_pontos_dinamico" numeric(8,2) NOT NULL DEFAULT 50.00;
