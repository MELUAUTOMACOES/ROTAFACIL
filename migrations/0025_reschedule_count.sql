-- Migration: Add reschedule_count field to appointments table
-- Purpose: Track how many times an appointment has been rescheduled

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;


-- Add comment for documentation
COMMENT ON COLUMN appointments.reschedule_count IS 'Contador de vezes que o agendamento foi reagendado';

-- Backfill: For existing appointments with status 'rescheduled', set count to 1
UPDATE appointments 
SET reschedule_count = 1 
WHERE status = 'rescheduled' AND reschedule_count = 0;
