import { Resend } from 'resend';

// Configuração do Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const EMAIL_FROM_PASSWORD_RESET = process.env.EMAIL_FROM_PASSWORD_RESET || 'novasenha@meluautomacao.com';
const EMAIL_FROM_INVITE = process.env.EMAIL_FROM_INVITE || 'convite@meluautomacao.com';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO; // Email para receber respostas (opcional)
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

// Template de email de verificação
function getVerificationEmailTemplate(userName: string, verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verificação de Email - Rota Fácil</title>
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
                    Bem-vindo(a), ${userName}! 👋
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Sua conta foi criada com sucesso no <strong>Rota Fácil</strong>!
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Para ativar sua conta e criar sua senha de acesso, clique no botão abaixo:
                  </p>
                  
                  <!-- Button -->
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 0 0 30px 0;">
                        <a href="${verificationLink}" 
                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(212, 175, 55, 0.3);">
                          ✅ Verificar Email e Criar Senha
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="background-color: #f8f9fa; border-left: 4px solid #D4AF37; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.5;">
                      <strong>⏰ Importante:</strong> Este link de verificação expira em <strong>24 horas</strong>.
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                  </p>
                  
                  <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f8f9fa; border-radius: 4px; font-size: 12px; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
                    ${verificationLink}
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                  
                  <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                    Se você não solicitou a criação desta conta, por favor ignore este email.
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
}

// Template de reenvio de verificação
function getResendVerificationEmailTemplate(userName: string, verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Novo Link de Verificação - Rota Fácil</title>
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
                    Olá, ${userName}! 🔄
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Você solicitou um novo link de verificação de email.
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Clique no botão abaixo para verificar seu email e criar sua senha:
                  </p>
                  
                  <!-- Button -->
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 0 0 30px 0;">
                        <a href="${verificationLink}" 
                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(212, 175, 55, 0.3);">
                          ✅ Verificar Email Agora
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                      <strong>⏰ Atenção:</strong> Este é um novo link. O anterior não funciona mais.
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    Link alternativo:
                  </p>
                  
                  <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f8f9fa; border-radius: 4px; font-size: 12px; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
                    ${verificationLink}
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                  
                  <p style="margin: 0; color: #999999; font-size: 13px; line-height: 1.5;">
                    Se você não solicitou este email, por favor ignore-o.
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
}

// Função para enviar email de verificação
export async function sendVerificationEmail(
  email: string, 
  userName: string, 
  token: string,
  isResend: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📧 [EMAIL] Iniciando envio de email de verificação para: ${email}`);
    
    // Validar chave da API
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ [EMAIL] RESEND_API_KEY não configurada no .env');
      return { success: false, error: 'Configuração de email não encontrada' };
    }
    
    // Montar link de verificação
    const verificationLink = `${APP_URL}/verify-email?token=${token}`;
    console.log(`🔗 [EMAIL] Link de verificação: ${verificationLink}`);
    
    // Selecionar template
    const htmlContent = isResend 
      ? getResendVerificationEmailTemplate(userName, verificationLink)
      : getVerificationEmailTemplate(userName, verificationLink);
    
    // Enviar email via Resend
    const emailPayload: any = {
      from: EMAIL_FROM,
      to: email,
      subject: isResend 
        ? '🔄 Novo Link de Verificação - Rota Fácil' 
        : '✅ Bem-vindo ao Rota Fácil - Verifique seu Email',
      html: htmlContent,
    };
    
    // Adicionar reply-to se configurado (para receber respostas em outro email)
    if (EMAIL_REPLY_TO) {
      emailPayload.replyTo = EMAIL_REPLY_TO;
    }
    
    const { data, error } = await resend.emails.send(emailPayload);
    
    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar via Resend:', error);
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }
    
    console.log('✅ [EMAIL] Email enviado com sucesso!');
    console.log('📬 [EMAIL] ID do email:', data?.id);
    
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ [EMAIL] Erro inesperado ao enviar email:', error);
    return { 
      success: false, 
      error: error.message || 'Erro inesperado ao enviar email' 
    };
  }
}

// Função para enviar email de teste (opcional)
export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📧 [EMAIL] Enviando email de teste para: ${to}`);
    
    const testEmailPayload: any = {
      from: EMAIL_FROM,
      to: to,
      subject: '✅ Email de Teste - Rota Fácil',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px;">
            <h1 style="color: #333;">🎉 Email de Teste</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Parabéns! O sistema de envio de emails do <strong>Rota Fácil</strong> está funcionando perfeitamente.
            </p>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              Este é um email de teste enviado via Resend.
            </p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              <strong>Configuração:</strong><br>
              De: ${EMAIL_FROM}<br>
              ${EMAIL_REPLY_TO ? `Responder para: ${EMAIL_REPLY_TO}` : ''}
            </p>
          </div>
        </div>
      `,
    };
    
    if (EMAIL_REPLY_TO) {
      testEmailPayload.replyTo = EMAIL_REPLY_TO;
    }
    
    const { data, error } = await resend.emails.send(testEmailPayload);
    
    if (error) {
      console.error('❌ [EMAIL] Erro no teste:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ [EMAIL] Email de teste enviado com sucesso!', data?.id);
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ [EMAIL] Erro inesperado no teste:', error);
    return { success: false, error: error.message };
  }
}

// Template de email de recuperação de senha
function getPasswordResetEmailTemplate(userName: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperação de Senha - Rota Fácil</title>
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
                    Olá, ${userName}! 🔑
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Recebemos uma solicitação para <strong>redefinir a senha</strong> da sua conta no Rota Fácil.
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                    Clique no botão abaixo para criar uma nova senha:
                  </p>
                  
                  <!-- Button -->
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 0 0 30px 0;">
                        <a href="${resetLink}" 
                           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #D4AF37 0%, #C5A028 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(212, 175, 55, 0.3);">
                          🔐 Redefinir Minha Senha
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                      <strong>⏰ Importante:</strong> Este link de recuperação expira em <strong>1 hora</strong>.
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                    Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                  </p>
                  
                  <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f8f9fa; border-radius: 4px; font-size: 12px; color: #6c757d; word-break: break-all; font-family: 'Courier New', monospace;">
                    ${resetLink}
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
                  
                  <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 16px; margin: 0 0 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #721c24; font-size: 14px; line-height: 1.5;">
                      <strong>🔒 Não solicitou?</strong> Se você não pediu para redefinir sua senha, ignore este email. Sua senha permanecerá inalterada e segura.
                    </p>
                  </div>
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
}

// Função para enviar email de recuperação de senha
export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`📧 [PASSWORD RESET] Iniciando envio para: ${email}`);
    
    // Validar chave da API
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ [PASSWORD RESET] RESEND_API_KEY não configurada');
      return { success: false, error: 'Configuração de email não encontrada' };
    }
    
    // Montar link de recuperação
    const resetLink = `${APP_URL}/reset-password?token=${token}`;
    console.log(`🔗 [PASSWORD RESET] Link: ${resetLink}`);
    
    // Template HTML
    const htmlContent = getPasswordResetEmailTemplate(userName, resetLink);
    
    // Payload do email
    const emailPayload: any = {
      from: EMAIL_FROM_PASSWORD_RESET,
      to: email,
      subject: '🔑 Recuperação de Senha - Rota Fácil',
      html: htmlContent,
    };
    
    // Adicionar reply-to se configurado
    if (EMAIL_REPLY_TO) {
      emailPayload.replyTo = EMAIL_REPLY_TO;
    }
    
    // Enviar via Resend
    const { data, error } = await resend.emails.send(emailPayload);
    
    if (error) {
      console.error('❌ [PASSWORD RESET] Erro ao enviar:', error);
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }
    
    console.log('✅ [PASSWORD RESET] Email enviado com sucesso!');
    console.log('📬 [PASSWORD RESET] ID:', data?.id);
    
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ [PASSWORD RESET] Erro inesperado:', error);
    return { 
      success: false, 
      error: error.message || 'Erro inesperado ao enviar email' 
    };
  }
}
