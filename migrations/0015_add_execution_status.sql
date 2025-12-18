ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "execution_status" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "execution_notes" text;
