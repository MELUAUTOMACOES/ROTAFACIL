import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM_INVITE = process.env.EMAIL_FROM_INVITE || 'convite@meluautomacao.com';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

// Função para enviar email de convite para usuário entrar em empresa
export async function sendInvitationEmail(
  email: string,
  companyName: string,
  role: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📧 [INVITATION] Enviando convite para: ${email}`);
    
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ [INVITATION] RESEND_API_KEY não configurada');
      return { success: false, error: 'Configuração de email não encontrada' };
    }
    
    const roleMap: Record<string, string> = {
      'ADMIN': 'Administrador',
      'ADMINISTRATIVO': 'Administrativo',
      'OPERADOR': 'Operador'
    };
    const rolePt = roleMap[role] || role;
    
    const inviteLink = `${APP_URL}/convite/${token}`;
    console.log(`🔗 [INVITATION] Link do convite: ${inviteLink}`);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Convite - Rota Fácil</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      Rota<span style="color: #D4AF37;">Fácil</span>
                    </h1>
                    <p style="margin: 10px 0 0 0; color: #cccccc; font-size: 14px;">Sistema de Roteirização Inteligente</p>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">
                      Você foi convidado! 🎉
                    </h2>
                    
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      A empresa <strong>${companyName}</strong> convidou você para fazer parte da equipe como <strong>${rolePt}</strong>.
                    </p>
                    
                    <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      Clique no botão abaixo para aceitar o convite e começar a usar o Rota Fácil:
                    </p>
                    
                    <!-- Button -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 0 0 30px 0;">
                          <a href="${inviteLink}" 
                             style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(212, 175, 55, 0.3);">
                            ✅ Aceitar Convite
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #0d47a1; font-size: 14px; line-height: 1.5;">
                        <strong>📋 Seu papel:</strong> ${rolePt}<br>
                        <strong>🏢 Empresa:</strong> ${companyName}<br>
                        <strong>⏰ Validade:</strong> 7 dias
                      </p>
                    </div>
                    
                    <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                    </p>
                    
                    <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f8f9fa; border-radius: 4px; font-size: 12px; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
                      ${inviteLink}
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                    
                    <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                      Se você não esperava este convite, pode ignorar este email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 13px;">
                      © 2025 Rota Fácil - Todos os direitos reservados
                    </p>
                    <p style="margin: 0; color: #adb5bd; font-size: 12px;">
                      Sistema de Roteirização e Gestão de Equipes
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    
    const emailPayload: any = {
      from: EMAIL_FROM_INVITE,
      to: email,
      subject: `🎉 Convite para ${companyName} - Rota Fácil`,
      html: htmlContent,
    };
    
    if (EMAIL_REPLY_TO) {
      emailPayload.replyTo = EMAIL_REPLY_TO;
    }
    
    const { data, error } = await resend.emails.send(emailPayload);
    
    if (error) {
      console.error('❌ [INVITATION] Erro ao enviar:', error);
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }
    
    console.log('✅ [INVITATION] Email enviado com sucesso!');
    console.log('📬 [INVITATION] ID:', data?.id);
    
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ [INVITATION] Erro inesperado:', error);
    return { 
      success: false, 
      error: error.message || 'Erro inesperado ao enviar email' 
    };
  }
}
