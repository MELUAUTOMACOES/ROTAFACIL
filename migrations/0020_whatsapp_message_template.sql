-- Migration: Adicionar campo de mensagem WhatsApp em business_rules
-- Created at: 2025-12-25

ALTER TABLE business_rules
ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT DEFAULT 'Olá, {nome_cliente}! Sou da {nome_empresa}, estou a caminho para realizar o serviço {nome_servico}. Previsão de chegada: {horario_estimado}.';
