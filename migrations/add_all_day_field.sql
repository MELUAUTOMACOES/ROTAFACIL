-- Add allDay field to appointments table
ALTER TABLE appointments 
ADD COLUMN all_day boolean DEFAULT false NOT NULL;

-- Update existing appointments to have allDay = false
UPDATE appointments 
SET all_day = false 
WHERE all_day IS NULL;