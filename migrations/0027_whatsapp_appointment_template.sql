-- Adiciona campo para template de mensagem de agendamento no WhatsApp
-- Diferente do whatsapp_message_template existente (usado para "a caminho" pelos prestadores),
-- este campo é usado para mensagens de confirmação de agendamento
ALTER TABLE business_rules 
ADD COLUMN whatsapp_appointment_message_template TEXT 
DEFAULT 'Olá, {nome_cliente}! Confirmamos seu agendamento de {nome_servico} para {data_agendamento}. Endereço: {endereco}.';
