-- Migration: Adicionar campos de horários de trabalho em técnicos e equipes
-- Migração dos campos de horário de trabalho das regras de negócio para técnicos e equipes individuais

-- Adicionar campos na tabela technicians
ALTER TABLE "technicians" 
  ADD COLUMN IF NOT EXISTS "horario_inicio_trabalho" TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "horario_fim_trabalho" TEXT DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS "horario_almoco_minutos" INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "dias_trabalho" TEXT[] DEFAULT ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

-- Adicionar campos na tabela teams
ALTER TABLE "teams" 
  ADD COLUMN IF NOT EXISTS "horario_inicio_trabalho" TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "horario_fim_trabalho" TEXT DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS "horario_almoco_minutos" INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "dias_trabalho" TEXT[] DEFAULT ARRAY['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

-- Comentários explicativos
COMMENT ON COLUMN "technicians"."horario_inicio_trabalho" IS 'Horário de início do trabalho no formato HH:MM';
COMMENT ON COLUMN "technicians"."horario_fim_trabalho" IS 'Horário de fim do trabalho no formato HH:MM';
COMMENT ON COLUMN "technicians"."horario_almoco_minutos" IS 'Tempo de almoço em minutos a ser descontado do tempo total';
COMMENT ON COLUMN "technicians"."dias_trabalho" IS 'Array com os dias da semana que o técnico trabalha (segunda, terca, quarta, quinta, sexta, sabado, domingo)';

COMMENT ON COLUMN "teams"."horario_inicio_trabalho" IS 'Horário de início do trabalho no formato HH:MM';
COMMENT ON COLUMN "teams"."horario_fim_trabalho" IS 'Horário de fim do trabalho no formato HH:MM';
COMMENT ON COLUMN "teams"."horario_almoco_minutos" IS 'Tempo de almoço em minutos a ser descontado do tempo total';
COMMENT ON COLUMN "teams"."dias_trabalho" IS 'Array com os dias da semana que a equipe trabalha (segunda, terca, quarta, quinta, sexta, sabado, domingo)';

-- Copiar dados das regras de negócio para técnicos e equipes existentes (se houver regras)
-- Isso garante que técnicos/equipes existentes herdem os horários atuais
DO $$
DECLARE
    business_rule RECORD;
BEGIN
    -- Buscar primeira regra de negócio de cada usuário
    FOR business_rule IN 
        SELECT DISTINCT ON (user_id) 
            user_id, 
            horario_inicio_trabalho, 
            horario_fim_trabalho
        FROM business_rules
        ORDER BY user_id, created_at DESC
    LOOP
        -- Atualizar técnicos do usuário
        UPDATE technicians 
        SET 
            horario_inicio_trabalho = business_rule.horario_inicio_trabalho,
            horario_fim_trabalho = business_rule.horario_fim_trabalho
        WHERE user_id = business_rule.user_id;
        
        -- Atualizar equipes do usuário
        UPDATE teams 
        SET 
            horario_inicio_trabalho = business_rule.horario_inicio_trabalho,
            horario_fim_trabalho = business_rule.horario_fim_trabalho
        WHERE user_id = business_rule.user_id;
        
        RAISE NOTICE 'Horários copiados para técnicos e equipes do usuário %', business_rule.user_id;
    END LOOP;
END $$;
