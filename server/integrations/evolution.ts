export async function sendLeadWhatsappNotification(lead: any) {
    try {
        const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } = process.env;

        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
            console.log('⚠️ [WHATSAPP] Credenciais da Evolution API ausentes. Notificação WhatsApp pulada.');
            return false;
        }

        const mensagem = `🚨 *Novo lead no RotaFácil*

*Nome:* ${lead.name || '-'}
*Empresa:* ${lead.companyName || '-'}
*Telefone:* ${lead.phone || '-'}
*Email:* ${lead.email || '-'}
*Origem:* Agendar demonstração
*Cenário:* ${lead.industry || '-'} ${lead.otherIndustry ? `(${lead.otherIndustry})` : ''}

*Enviado em:* ${new Date().toLocaleString('pt-BR')}`;

        console.log('[WHATSAPP] Tentando enviar WhatsApp para meluautomacoes...');

        const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
                number: "554196428707",
                text: mensagem,
                delay: 1000,
                linkPreview: false,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`❌ [WHATSAPP] Erro HTTP ${response.status} da Evolution API:`, errorData);
            return false;
        }

        const data = await response.json();
        console.log(`✅ [WHATSAPP] Mensagem enviada com sucesso para notificação de novo lead.`);
        return true;
    } catch (error) {
        console.error('❌ [WHATSAPP] Falha ao conectar na Evolution API:', error);
        return false; // Nunca deve quebrar a execução principal
    }
}
