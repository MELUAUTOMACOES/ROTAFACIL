import type { Express } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { sendVerificationEmail } from "../email";
import { sendInvitationEmail } from "../email-invitation";
import {
  signupCompanySchema,
  createInvitationSchema,
  acceptInvitationNewUserSchema,
  acceptInvitationExistingUserSchema,
  resendInvitationSchema,
} from "@shared/schema";
import { db } from "../db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "development_jwt_secret_key_32_characters_long_minimum_for_security_rotafacil_2025";

// Rate limiter para cadastro de empresa: 10 tentativas por IP a cada 15 minutos
const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Muitas tentativas de cadastro. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para reenvio de verificação: 3 tentativas por IP a cada 30 minutos
const resendVerificationRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 3,
  message: { message: "Muitas tentativas de reenvio. Aguarde antes de tentar novamente." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware para verificar se usuário tem papel ADMIN na empresa (case-insensitive)
function requireCompanyAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ message: 'Autenticação necessária' });
  }

  // Verificar se o usuário tem membership ADMIN na empresa
  // O companyId deve vir do contexto (por exemplo, de um header ou do token JWT)
  // Por enquanto, vamos assumir que o companyId está em req.user.companyId

  if (!req.user.companyId || !req.user.companyRole) {
    return res.status(403).json({ message: 'Acesso negado. Você não está vinculado a uma empresa.' });
  }

  const companyRole = (req.user.companyRole || '').toLowerCase();
  if (companyRole !== 'admin') {
    return res.status(403).json({
      message: 'Acesso negado. Apenas administradores podem realizar esta ação.',
      currentRole: req.user.companyRole,
      requiredRole: 'ADMIN'
    });
  }

  next();
}

export function registerCompanyRoutes(app: Express, authenticateToken: any) {

  // ==================== CADASTRO DE EMPRESA + ADMIN ====================

  // Criar nova empresa + administrador (rota pública, com rate limit)
  app.post("/api/auth/signup-company", signupRateLimiter, async (req, res) => {
    try {
      console.log("📝 [SIGNUP COMPANY] Iniciando cadastro de empresa");

      const data = signupCompanySchema.parse(req.body);

      // Verificar se CNPJ já existe
      const existingCompany = await storage.getCompanyByCnpj(data.company.cnpj);
      if (existingCompany) {
        return res.status(400).json({
          message: "Este CNPJ já está cadastrado no sistema."
        });
      }

      // Verificar se email do admin já existe
      const existingUser = await storage.getUserByEmail(data.admin.email);
      if (existingUser) {
        return res.status(400).json({
          message: "Este email já está cadastrado. Se você já tem conta, faça login e aguarde um convite da empresa."
        });
      }

      // Criar empresa
      const company = await storage.createCompany({
        name: data.company.name,
        cnpj: data.company.cnpj,
        telefone: data.company.telefone,
        email: data.company.email,
        cep: data.company.cep,
        logradouro: data.company.logradouro,
        numero: data.company.numero,
        cidade: data.company.cidade,
        estado: data.company.estado,
        segmento: data.company.segmento,
        servicos: data.company.servicos,
        comoConheceu: data.company.comoConheceu,
        problemaPrincipal: data.company.problemaPrincipal,
        plan: data.company.plan || 'free',
        statusAssinatura: 'active',
      });

      console.log(`✅ [SIGNUP COMPANY] Empresa criada: ${company.name} (ID: ${company.id})`);

      // Criar usuário admin (senha temporária que será definida após verificação de email)
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const user = await storage.createUser({
        username: data.admin.email.split('@')[0], // Username baseado no email
        email: data.admin.email,
        password: tempPassword,
        name: data.admin.name,
        phone: data.admin.phone,
        emailVerified: false,
        plan: 'basic',
        role: 'admin', // Compatibilidade com sistema antigo
      });

      console.log(`✅ [SIGNUP COMPANY] Admin criado: ${user.email} (ID: ${user.id})`);

      // Criar membership ADMIN
      const membership = await storage.createMembership({
        userId: user.id,
        companyId: company.id,
        role: 'ADMIN',
        isActive: true,
      });

      console.log(`✅ [SIGNUP COMPANY] Membership criado: USER ${user.id} -> COMPANY ${company.id} (ADMIN)`);

      // Gerar token de verificação de email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24); // Token válido por 24 horas

      await storage.setEmailVerificationToken(user.id, verificationToken, expiry);

      // Enviar email de verificação
      const emailResult = await sendVerificationEmail(user.email, user.name, verificationToken, false);

      if (!emailResult.success) {
        console.warn(`⚠️ [SIGNUP COMPANY] Empresa criada mas email não foi enviado: ${emailResult.error}`);
      }

      console.log(`✅ [SIGNUP COMPANY] Cadastro completo! Email de verificação enviado.`);

      res.json({
        message: 'Empresa cadastrada com sucesso! Verifique seu email para ativar a conta e definir sua senha.',
        company: {
          id: company.id,
          name: company.name,
        },
        user: {
          email: user.email,
          name: user.name,
        }
      });
    } catch (error: any) {
      console.error("❌ [SIGNUP COMPANY] Erro:", error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Dados inválidos. Verifique todos os campos obrigatórios.",
          errors: error.errors
        });
      }

      res.status(500).json({ message: error.message || "Erro ao cadastrar empresa" });
    }
  });

  // ==================== REENVIO DE EMAIL DE VERIFICAÇÃO (PÚBLICO) ====================

  app.post("/api/auth/resend-verification", resendVerificationRateLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: "Email é obrigatório." });
      }

      console.log(`📧 [RESEND VERIFICATION] Solicitação para: ${email}`);

      // Resposta genérica para não revelar se o email existe ou não (segurança)
      const genericResponse = { message: "Se o email estiver cadastrado e não verificado, um novo link de verificação será enviado." };

      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log(`⚠️ [RESEND VERIFICATION] Email não encontrado: ${email}`);
        return res.json(genericResponse);
      }

      if (user.emailVerified) {
        console.log(`⚠️ [RESEND VERIFICATION] Email já verificado: ${email}`);
        return res.json(genericResponse);
      }

      // Gerar novo token
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);

      await storage.setEmailVerificationToken(user.id, token, expiry);

      // Enviar email (isResend = true para template de reenvio)
      const emailResult = await sendVerificationEmail(user.email, user.name, token, true);

      if (!emailResult.success) {
        console.error(`❌ [RESEND VERIFICATION] Erro ao enviar: ${emailResult.error}`);
        return res.status(500).json({ message: "Erro ao enviar email de verificação. Tente novamente mais tarde." });
      }

      console.log(`✅ [RESEND VERIFICATION] Email reenviado para: ${user.email}`);

      res.json(genericResponse);
    } catch (error: any) {
      console.error("❌ [RESEND VERIFICATION] Erro:", error);
      res.status(500).json({ message: error.message || "Erro ao reenviar verificação" });
    }
  });

  // ==================== DADOS DA EMPRESA (AUTENTICADO) ====================

  // Retorna dados completos da empresa do usuário logado (incluindo endereço)
  app.get("/api/company/info", authenticateToken, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      if (!companyId) {
        return res.status(404).json({ message: "Usuário não vinculado a nenhuma empresa." });
      }
      const company = await storage.getCompanyById(companyId);
      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada." });
      }
      res.json({
        id: company.id,
        name: company.name,
        cnpj: company.cnpj,
        telefone: company.telefone,
        email: company.email,
        cep: company.cep,
        logradouro: company.logradouro,
        numero: company.numero,
        cidade: company.cidade,
        estado: company.estado,
        segmento: company.segmento,
        plan: company.plan,
      });
    } catch (error: any) {
      console.error("❌ Erro ao buscar info da empresa:", error);
      res.status(500).json({ message: error.message || "Erro ao buscar dados da empresa" });
    }
  });

  // ==================== GESTÃO DE USUÁRIOS DA EMPRESA ====================

  // Listar usuários e convites da empresa (apenas admin)
  app.get("/api/company/users", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;

      console.log(`📋 [COMPANY USERS] Listando usuários da empresa ${companyId}...`);

      // Buscar TODAS as memberships da empresa (ativas E inativas)
      const allMemberships = await storage.getAllMembershipsByCompanyId(companyId);

      console.log(`✅ [COMPANY USERS] Total de memberships: ${allMemberships.length}`);

      // Separar memberships ativas e inativas
      const activeMemberships = allMemberships.filter(m => m.isActive);
      const inactiveMemberships = allMemberships.filter(m => !m.isActive);

      console.log(`   - Ativas: ${activeMemberships.length}`);
      console.log(`   - Inativas: ${inactiveMemberships.length}`);

      // Função helper para mapear membership em user data
      const mapMembershipToUser = async (membership: any) => {
        const user = await storage.getUserById(membership.userId);
        if (!user) return null;

        const { password, emailVerificationToken, ...userWithoutSensitiveData } = user;
        
        const roleMap: Record<string, string> = {
          'ADMIN': 'admin',
          'OPERADOR': 'operador',
          'ADMINISTRATIVO': 'user',
          'TECNICO': 'tecnico',
          'PRESTADOR': 'prestador',
        };
        const normalizedRole = roleMap[membership.role] || membership.role.toLowerCase();
        
        return {
          ...userWithoutSensitiveData,
          name: membership.displayName || user.name,
          role: normalizedRole,
          isActive: membership.isActive,
        };
      };

      // Buscar dados dos usuários ativos
      const activeUsersData = await Promise.all(
        activeMemberships.map(mapMembershipToUser)
      );

      // Buscar dados dos usuários inativos
      const inactiveUsersData = await Promise.all(
        inactiveMemberships.map(mapMembershipToUser)
      );

      // Buscar convites pendentes
      const invitations = await storage.getInvitationsByCompanyId(companyId);
      const now = new Date();
      const pendingInvites = invitations
        .filter(inv => inv.status === 'pending')
        .map(inv => ({
          id: inv.id,
          email: inv.email,
          displayName: inv.displayName,
          role: inv.role,
          phone: inv.phone,
          status: inv.expiresAt < now ? 'expired' : 'pending',
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
          resentAt: inv.resentAt,
          preRegistered: inv.preRegistered,
        }));

      console.log(`   - Convites pendentes: ${pendingInvites.length}`);

      res.json({
        activeUsers: activeUsersData.filter(Boolean),
        inactiveUsers: inactiveUsersData.filter(Boolean),
        pendingInvites,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar usuários:", error);
      res.status(500).json({ message: error.message || "Erro ao listar usuários" });
    }
  });

  // Convidar usuário para empresa (apenas admin)
  // Este endpoint é o único caminho oficial de entrada de novos usuários
  // Para e-mail já existente em outra empresa: convite é criado silenciosamente (sem revelar ao admin)
  app.post("/api/company/users/invite", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      console.log("📧 [INVITE] Criando pré-cadastro e convite");

      const companyId = req.user.companyId;
      const invitedBy = req.user.userId;
      const inviteData = createInvitationSchema.parse(req.body);

      // --- Verificação 1: Usuário já é membro desta empresa? ---
      const existingUser = await storage.getUserByEmail(inviteData.email);
      if (existingUser) {
        const existingMembership = await storage.getMembership(existingUser.id, companyId);
        if (existingMembership) {
          return res.status(400).json({
            message: "Este usuário já faz parte da empresa."
          });
        }
        // Usuário existe em OUTRA empresa — tratamento silencioso (regra de privacidade)
        // Fluxo interno difere (accept-existing), mas a resposta ao admin é idêntica
        console.log(`🔒 [INVITE] E-mail existente em outra empresa. Convite criado silenciosamente.`);
      }

      // --- Verificação 2: Já existe convite PENDING para esse e-mail nesta empresa? ---
      const existingInvitations = await storage.getInvitationsByCompanyId(companyId);
      const pendingInvite = existingInvitations.find(
        inv => inv.email.toLowerCase() === inviteData.email.toLowerCase() && inv.status === 'pending'
      );
      if (pendingInvite) {
        return res.status(400).json({
          message: "Já existe um convite pendente para este e-mail nesta empresa."
        });
      }

      // --- Criar convite com dados do pré-cadastro ---
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

      const invitation = await storage.createInvitation({
        companyId,
        email: inviteData.email.toLowerCase(),
        role: inviteData.role,
        token,
        status: 'pending',
        expiresAt,
        invitedBy,
        // Dados do pré-cadastro do admin
        preRegistered: true,
        displayName: inviteData.displayName,
        phone: inviteData.phone || null,
        accessScheduleId: inviteData.accessScheduleId || null,
        cep: inviteData.cep || null,
        logradouro: inviteData.logradouro || null,
        numero: inviteData.numero || null,
        complemento: inviteData.complemento || null,
        bairro: inviteData.bairro || null,
        cidade: inviteData.cidade || null,
        estado: inviteData.estado || null,
      });

      // Buscar dados da empresa para o e-mail
      const company = await storage.getCompanyById(companyId);

      // Enviar e-mail de convite
      const emailResult = await sendInvitationEmail(
        inviteData.email,
        company!.name,
        inviteData.role,
        token
      );

      if (!emailResult.success) {
        console.warn(`⚠️ [INVITE] Convite criado mas email não foi enviado: ${emailResult.error}`);
      }

      console.log(`✅ [INVITE] Convite criado para: ${inviteData.email} (empresa ${companyId})`);

      // Resposta idêntica independente de o e-mail já existir ou não (privacidade)
      res.json({
        message: 'Convite enviado com sucesso! A pessoa receberá um e-mail para ativar a conta.',
        invitation: {
          id: invitation.id,
          email: invitation.email,
          displayName: invitation.displayName,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        }
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar convite:", error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Dados inválidos.",
          errors: error.errors
        });
      }

      res.status(500).json({ message: error.message || "Erro ao criar convite" });
    }
  });

  // ==================== REENVIO E CANCELAMENTO DE CONVITES ====================

  // Reenviar convite pendente (admin)
  app.patch("/api/invitations/:id/resend", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      const companyId = req.user.companyId;

      if (isNaN(invitationId)) {
        return res.status(400).json({ message: 'ID de convite inválido.' });
      }

      // Buscar e validar o convite (garante isolamento por empresa)
      const invitation = await storage.getInvitationById(invitationId);

      if (!invitation || invitation.companyId !== companyId) {
        return res.status(404).json({ message: 'Convite não encontrado.' });
      }

      if (invitation.status === 'accepted') {
        return res.status(400).json({ message: 'Este convite já foi aceito e não pode ser reenviado.' });
      }

      if (invitation.status === 'cancelled') {
        return res.status(400).json({ message: 'Este convite foi cancelado e não pode ser reenviado.' });
      }

      // Gerar novo token e renovar expiração
      const newToken = crypto.randomBytes(32).toString('hex');
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const updatedInvitation = await storage.resendInvitation(invitationId, newToken, newExpiresAt);

      // Buscar dados da empresa para o e-mail
      const company = await storage.getCompanyById(companyId);

      // Enviar novo e-mail
      const emailResult = await sendInvitationEmail(
        invitation.email,
        company!.name,
        invitation.role,
        newToken
      );

      if (!emailResult.success) {
        console.warn(`⚠️ [RESEND] Convite atualizado mas novo e-mail não foi enviado: ${emailResult.error}`);
      }

      console.log(`✅ [RESEND] Convite reenviado: ID ${invitationId} para ${invitation.email}`);

      res.json({
        message: 'Convite reenviado com sucesso!',
        invitation: {
          id: updatedInvitation.id,
          email: updatedInvitation.email,
          expiresAt: updatedInvitation.expiresAt,
          resentAt: updatedInvitation.resentAt,
        }
      });
    } catch (error: any) {
      console.error('❌ Erro ao reenviar convite:', error);
      res.status(500).json({ message: error.message || 'Erro ao reenviar convite' });
    }
  });

  // Cancelar convite pendente (admin)
  app.patch("/api/invitations/:id/cancel", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      const companyId = req.user.companyId;
      const cancelledBy = req.user.userId;

      if (isNaN(invitationId)) {
        return res.status(400).json({ message: 'ID de convite inválido.' });
      }

      // Buscar e validar o convite (garante isolamento por empresa)
      const invitation = await storage.getInvitationById(invitationId);

      if (!invitation || invitation.companyId !== companyId) {
        return res.status(404).json({ message: 'Convite não encontrado.' });
      }

      if (invitation.status === 'accepted') {
        return res.status(400).json({ message: 'Este convite já foi aceito e não pode ser cancelado.' });
      }

      if (invitation.status === 'cancelled') {
        return res.status(400).json({ message: 'Este convite já foi cancelado.' });
      }

      await storage.cancelInvitation(invitationId, cancelledBy);

      console.log(`✅ [CANCEL] Convite cancelado: ID ${invitationId} por user ${cancelledBy}`);

      res.json({ message: 'Convite cancelado. O link de ativação foi desativado.' });
    } catch (error: any) {
      console.error('❌ Erro ao cancelar convite:', error);
      res.status(500).json({ message: error.message || 'Erro ao cancelar convite' });
    }
  });

  // ==================== DESATIVAÇÃO E REATIVAÇÃO DE USUÁRIOS ====================

  // Desativar acesso de usuário na empresa (soft delete na membership)
  app.patch("/api/company/users/:userId/deactivate", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const companyId = req.user.companyId;
      const adminUserId = req.user.userId;

      if (isNaN(userId)) {
        return res.status(400).json({ message: 'ID de usuário inválido.' });
      }

      // Não permitir desativar a si mesmo
      if (userId === adminUserId) {
        return res.status(400).json({ 
          message: "Você não pode desativar sua própria conta." 
        });
      }

      // Verificar se membership existe e está ativa
      const membership = await storage.getMembership(userId, companyId);
      if (!membership) {
        return res.status(404).json({ 
          message: "Usuário não encontrado nesta empresa." 
        });
      }

      // Desativar membership (soft delete - NÃO mexe em users.is_active)
      await storage.deactivateMembership(userId, companyId);

      console.log(`🚫 [DEACTIVATE] Membership desativada: user ${userId} na empresa ${companyId}`);

      res.json({ 
        message: "Acesso do usuário desativado nesta empresa com sucesso." 
      });
    } catch (error: any) {
      console.error('❌ Erro ao desativar usuário:', error);
      res.status(500).json({ message: error.message || 'Erro ao desativar usuário' });
    }
  });

  // Reativar acesso de usuário na empresa
  app.patch("/api/company/users/:userId/reactivate", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const companyId = req.user.companyId;

      if (isNaN(userId)) {
        return res.status(400).json({ message: 'ID de usuário inválido.' });
      }

      // Buscar membership (inclusive inativa)
      const membership = await storage.getMembershipIncludingInactive(userId, companyId);
      if (!membership) {
        return res.status(404).json({ 
          message: "Usuário não encontrado nesta empresa." 
        });
      }

      if (membership.isActive) {
        return res.status(400).json({ 
          message: "Este usuário já está ativo nesta empresa." 
        });
      }

      // Reativar membership (NÃO mexe em users.is_active)
      await storage.reactivateMembership(userId, companyId);

      console.log(`✅ [REACTIVATE] Membership reativada: user ${userId} na empresa ${companyId}`);

      res.json({ 
        message: "Acesso do usuário reativado nesta empresa com sucesso." 
      });
    } catch (error: any) {
      console.error('❌ Erro ao reativar usuário:', error);
      res.status(500).json({ message: error.message || 'Erro ao reativar usuário' });
    }
  });

  // ==================== ACEITAÇÃO DE CONVITES ====================

  // Validar convite (rota pública) — retorna dados do pré-cadastro para exibição na tela de aceite
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const invitation = await storage.getInvitationByToken(token);

      if (!invitation) {
        return res.status(404).json({ message: "Convite não encontrado ou link inválido." });
      }

      if (invitation.status === 'cancelled') {
        return res.status(400).json({ message: "Este convite foi cancelado. Entre em contato com o administrador da empresa.", code: "INVITATION_CANCELLED" });
      }

      if (invitation.status === 'accepted') {
        return res.status(400).json({ message: "Este convite já foi utilizado.", code: "INVITATION_ALREADY_ACCEPTED" });
      }

      if (invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Este convite expirou. Entre em contato com o administrador para receber um novo convite.", code: "INVITATION_EXPIRED" });
      }

      // Buscar dados da empresa
      const company = await storage.getCompanyById(invitation.companyId);

      // Verificar se o email já tem usuário ativo (hasAccount guia o frontend para fluxo correto)
      const existingUser = await storage.getUserByEmail(invitation.email);

      res.json({
        invitation: {
          email: invitation.email,
          role: invitation.role,
          // Dados do pré-cadastro (somente leitura para o convidado)
          displayName: invitation.displayName,
          phone: invitation.phone,
          cep: invitation.cep,
          logradouro: invitation.logradouro,
          numero: invitation.numero,
          complemento: invitation.complemento,
          bairro: invitation.bairro,
          cidade: invitation.cidade,
          estado: invitation.estado,
          preRegistered: invitation.preRegistered,
          company: {
            id: company!.id,
            name: company!.name,
          },
        },
        hasAccount: !!existingUser,
      });
    } catch (error: any) {
      console.error("❌ Erro ao validar convite:", error);
      res.status(500).json({ message: error.message || "Erro ao validar convite" });
    }
  });

  // Aceitar convite — usuário NOVO (rota pública)
  // O convidado define username, senha e aceita LGPD
  // Dados do admin (nome, endereço, telefone) vêm do pré-cadastro na invitation
  app.post("/api/invitations/:token/accept-new", async (req, res) => {
    try {
      const { token } = req.params;
      const data = acceptInvitationNewUserSchema.parse(req.body);

      console.log(`🎫 [ACCEPT INVITE NEW] Novo usuário aceitando convite: ${token.substring(0, 8)}...`);

      const invitation = await storage.getInvitationByToken(data.token);

      if (!invitation) {
        return res.status(400).json({ message: "Convite inválido ou não encontrado.", code: "INVITATION_INVALID" });
      }

      if (invitation.status === 'cancelled') {
        return res.status(400).json({ message: "Este convite foi cancelado.", code: "INVITATION_CANCELLED" });
      }

      if (invitation.status === 'accepted') {
        return res.status(400).json({ message: "Este convite já foi utilizado.", code: "INVITATION_ALREADY_ACCEPTED" });
      }

      if (invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Este convite expirou. Solicite um novo convite ao administrador.", code: "INVITATION_EXPIRED" });
      }

      // Verificar se já existe usuário com este email (race condition protection)
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({
          message: "Este e-mail já possui uma conta. Use a opção de login."
        });
      }

      // Verificar unicidade do username
      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({
          message: "Este nome de usuário já está em uso. Escolha outro.",
          code: "USERNAME_TAKEN",
        });
      }

      console.log(`📝 [ACCEPT INVITE NEW] Iniciando transação atômica...`);

      // 🔒 TRANSAÇÃO ATÔMICA: users + memberships + invitations
      let user: any;
      let membership: any;

      await db.transaction(async (trx) => {
        const { users: usersTable, memberships: membershipsTable, invitations: invitationsTable } = await import('@shared/schema');
        const { eq: eqFn } = await import('drizzle-orm');
        const bcrypt = (await import('bcryptjs')).default;

        // 1. Criar usuário com dados do admin + credenciais do convidado
        const [createdUser] = await trx.insert(usersTable).values({
          username: data.username,
          email: invitation.email,
          password: await bcrypt.hash(data.password, 10),
          name: invitation.displayName || invitation.email.split('@')[0],
          phone: invitation.phone || null,
          // Endereço do admin — NÃO editável pelo convidado
          cep: invitation.cep || null,
          logradouro: invitation.logradouro || null,
          numero: invitation.numero || null,
          complemento: invitation.complemento || null,
          bairro: invitation.bairro || null,
          cidade: invitation.cidade || null,
          estado: invitation.estado || null,
          // Status de acesso: link clicado = e-mail verificado, senha definida pelo próprio usuário
          emailVerified: true,
          requirePasswordChange: false,
          isActive: true,
          plan: 'basic',
          role: 'user',
          // Tabela de horário de acesso definida pelo admin
          accessScheduleId: invitation.accessScheduleId || null,
          // LGPD: aceito pelo convidado no momento do aceite
          lgpdAccepted: true,
          lgpdAcceptedAt: new Date(),
          lgpdVersion: data.lgpdVersion,
          createdBy: invitation.invitedBy,
        }).returning();
        user = createdUser;

        // 2. Criar membership
        const [createdMembership] = await trx.insert(membershipsTable).values({
          userId: createdUser.id,
          companyId: invitation.companyId,
          role: invitation.role,
          displayName: invitation.displayName,
          isActive: true,
        }).returning();
        membership = createdMembership;

        // 3. Marcar convite como aceito (com timestamp de auditoria)
        await trx.update(invitationsTable)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eqFn(invitationsTable.id, invitation.id));
      });

      console.log(`✅ [ACCEPT INVITE NEW] Usuário criado (ID: ${user.id}), membership (ID: ${membership.id})`);

      // Gerar JWT
      const getSystemVersion = () => process.env.SYSTEM_VERSION || "1.0.0";
      const jwtToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          companyId: invitation.companyId,
          companyRole: invitation.role,
          sysVer: getSystemVersion()
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Conta ativada com sucesso!',
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
        },
      });
    } catch (error: any) {
      console.error("❌ Erro ao aceitar convite:", error);

      if (error.name === 'ZodError') {
        return res.status(400).json({
          message: "Dados inválidos.",
          errors: error.errors
        });
      }

      res.status(500).json({ message: error.message || "Erro ao aceitar convite" });
    }
  });


  // Aceitar convite - usuário existente (requer autenticação)
  app.post("/api/invitations/:token/accept-existing", authenticateToken, async (req: any, res) => {
    try {
      const { token } = req.params;
      
      console.log(`\n========================================`);
      console.log(`🎫 [ACCEPT EXISTING] REQUEST RECEBIDO`);
      console.log(`========================================`);
      console.log(`📍 IP: ${req.ip || req.headers['x-forwarded-for']}`);
      console.log(`📍 User-Agent: ${req.headers['user-agent']}`);
      console.log(`📍 Token do params: ${token}`);
      console.log(`📍 Body recebido:`, req.body);
      console.log(`📍 User autenticado:`, {
        userId: req.user.userId,
        email: req.user.email,
        companyId: req.user.companyId,
        companyRole: req.user.companyRole
      });
      
      const data = acceptInvitationExistingUserSchema.parse(req.body);
      console.log(`✅ [ACCEPT EXISTING] Schema validado com sucesso`);

      console.log(`🎫 [ACCEPT EXISTING] Usuário existente aceitando convite`);
      console.log(`   - User ID: ${req.user.userId}`);
      console.log(`   - Email: ${req.user.email}`);

      console.log(`🔍 [ACCEPT EXISTING] Buscando convite no banco...`);
      console.log(`   - Token: ${data.token.substring(0, 10)}...`);
      
      const invitation = await storage.getInvitationByToken(data.token);

      if (!invitation) {
        console.log(`❌ [ACCEPT EXISTING] ERRO: Convite não encontrado no banco!`);
        console.log(`   - Token usado: ${data.token.substring(0, 10)}...`);
        return res.status(400).json({ message: "Convite não encontrado" });
      }

      console.log(`✅ [ACCEPT EXISTING] Convite encontrado no banco!`);
      console.log(`📋 [ACCEPT EXISTING] Dados do convite:`);
      console.log(`   - ID: ${invitation.id}`);
      console.log(`   - Email convite: ${invitation.email}`);
      console.log(`   - Empresa: ${invitation.companyId}`);
      console.log(`   - Role: ${invitation.role}`);
      console.log(`   - Status: ${invitation.status}`);
      console.log(`   - Expira em: ${invitation.expiresAt}`);
      console.log(`   - Agora: ${new Date()}`);
      
      if (invitation.status !== 'pending') {
        console.log(`❌ [ACCEPT EXISTING] ERRO: Convite já foi usado!`);
        console.log(`   - Status atual: ${invitation.status}`);
        return res.status(400).json({ message: "Este convite já foi utilizado" });
      }
      
      if (invitation.expiresAt < new Date()) {
        console.log(`❌ [ACCEPT EXISTING] ERRO: Convite expirado!`);
        console.log(`   - Expirou em: ${invitation.expiresAt}`);
        console.log(`   - Data atual: ${new Date()}`);
        return res.status(400).json({ message: "Este convite expirou" });
      }

      // Verificar se o email do convite corresponde ao usuário logado
      console.log(`🔍 [ACCEPT EXISTING] Validando email...`);
      console.log(`   - Email do convite: ${invitation.email}`);
      console.log(`   - Email do usuário: ${req.user.email}`);
      console.log(`   - Match: ${invitation.email === req.user.email}`);
      
      if (invitation.email !== req.user.email) {
        console.log(`❌ [ACCEPT EXISTING] ERRO: Email não corresponde!`);
        console.log(`   - Convite para: ${invitation.email}`);
        console.log(`   - Usuário logado: ${req.user.email}`);
        return res.status(403).json({
          message: "Este convite não foi enviado para você."
        });
      }

      console.log(`✅ [ACCEPT EXISTING] Email validado!`);

      // Verificar se já é membro (inclusive memberships inativas)
      console.log(`🔍 [ACCEPT EXISTING] Verificando membership existente...`);
      console.log(`   - User ID: ${req.user.userId}`);
      console.log(`   - Company ID: ${invitation.companyId}`);
      
      const existingMembership = await storage.getMembershipIncludingInactive(req.user.userId, invitation.companyId);
      
      if (existingMembership && existingMembership.isActive) {
        console.log(`⚠️ [ACCEPT EXISTING] ERRO: Usuário já possui membership ATIVA!`);
        console.log(`   - Membership ID: ${existingMembership.id}`);
        console.log(`   - Role: ${existingMembership.role}`);
        return res.status(400).json({
          message: "Você já faz parte desta empresa."
        });
      }

      let membership: any;
      let updatedInvitation: any;

      // 🔒 TRANSAÇÃO ATÔMICA: membership + invitation
      await db.transaction(async (trx) => {
        const { memberships: membershipsTable, invitations: invitationsTable } = await import('@shared/schema');
        const { eq: eqFn, and: andFn } = await import('drizzle-orm');

        if (existingMembership && !existingMembership.isActive) {
          // CASO 2: Membership inativa já existe → REATIVAR
          console.log(`� [ACCEPT EXISTING] Membership inativa encontrada → REATIVANDO...`);
          console.log(`   - Membership ID: ${existingMembership.id}`);
          
          const [reactivatedMembership] = await trx.update(membershipsTable)
            .set({ 
              isActive: true,
              role: invitation.role,  // Atualizar role se mudou
              displayName: invitation.displayName  // Atualizar nome se mudou
            })
            .where(andFn(
              eqFn(membershipsTable.userId, req.user.userId),
              eqFn(membershipsTable.companyId, invitation.companyId)
            ))
            .returning();
          membership = reactivatedMembership;

          console.log(`✅ [ACCEPT EXISTING] Membership reativada (ID: ${membership.id})`);
        } else {
          // CASO 3: Membership não existe → CRIAR NOVA
          console.log(`📝 [ACCEPT EXISTING] Nenhuma membership existente → CRIANDO NOVA...`);
          
          const [createdMembership] = await trx.insert(membershipsTable).values({
            userId: req.user.userId,
            companyId: invitation.companyId,
            role: invitation.role,
            displayName: invitation.displayName,
            isActive: true,
          }).returning();
          membership = createdMembership;

          console.log(`✅ [ACCEPT EXISTING] Membership criada (ID: ${membership.id})`);
        }

        // Marcar convite como aceito
        const [updated] = await trx.update(invitationsTable)
          .set({ status: 'accepted', acceptedAt: new Date() })
          .where(eqFn(invitationsTable.id, invitation.id))
          .returning();
        updatedInvitation = updated;
      });

      console.log(`✅ [ACCEPT EXISTING] Processo concluído: user ${req.user.email} na empresa ${invitation.companyId}`);

      console.log(`✅ [ACCEPT EXISTING] Processo concluído: user ${req.user.email} na empresa ${invitation.companyId}`);

      const response = {
        message: 'Convite aceito com sucesso!',
        companyId: invitation.companyId,
        membership: {
          id: membership.id,
          companyId: membership.companyId,
          role: membership.role,
          isActive: membership.isActive,
        }
      };
      
      res.json(response);
    } catch (error: any) {
      console.error(`\n========================================`);
      console.error(`❌ [ACCEPT EXISTING] ERRO CAPTURADO!`);
      console.error(`========================================`);
      console.error(`   - Tipo: ${error.name}`);
      console.error(`   - Mensagem: ${error.message}`);
      console.error(`   - Stack:`, error.stack);
      console.error(`========================================\n`);

      if (error.name === 'ZodError') {
        console.error(`❌ [ACCEPT EXISTING] Erro de validação Zod:`, error.errors);
        return res.status(400).json({
          message: "Dados inválidos.",
          errors: error.errors
        });
      }

      res.status(500).json({ message: error.message || "Erro ao aceitar convite" });
    }
  });
}
