-- Migration: Add access_schedules table and accessScheduleId to users
-- Data: 2025-01-20
-- Descrição: Adiciona sistema de controle de horário de acesso à plataforma

-- Criar tabela de horários de acesso
CREATE TABLE IF NOT EXISTS "access_schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "schedules" jsonb NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Adicionar campo accessScheduleId na tabela users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "access_schedule_id" integer REFERENCES "access_schedules"("id") ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS "idx_users_access_schedule_id" ON "users"("access_schedule_id");
CREATE INDEX IF NOT EXISTS "idx_access_schedules_user_id" ON "access_schedules"("user_id");
