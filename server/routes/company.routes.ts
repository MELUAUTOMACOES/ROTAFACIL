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
} from "@shared/schema";
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

// Middleware para verificar se usuário tem papel ADMIN na empresa
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

  if (req.user.companyRole !== 'ADMIN') {
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

      // Buscar memberships da empresa
      const memberships = await storage.getMembershipsByCompanyId(companyId);

      // Buscar dados dos usuários
      const usersWithRoles = await Promise.all(
        memberships.map(async (membership) => {
          const user = await storage.getUserById(membership.userId);
          if (!user) return null;

          // Retornar TODOS os campos do usuário + role da membership
          const { password, emailVerificationToken, ...userWithoutSensitiveData } = user;
          
          return {
            ...userWithoutSensitiveData,
            name: membership.displayName || user.name,  // Nome específico da empresa ou nome global
            role: membership.role,  // Role específica da empresa (da membership)
            isActive: membership.isActive,  // Status específico da empresa (da membership)
          };
        })
      );

      // Buscar convites pendentes
      const invitations = await storage.getInvitationsByCompanyId(companyId);
      const pendingInvites = invitations
        .filter(inv => inv.status === 'pending')
        .map(inv => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
          createdAt: inv.createdAt,
        }));

      res.json({
        users: usersWithRoles.filter(Boolean),
        pendingInvites,
      });
    } catch (error: any) {
      console.error("❌ Erro ao listar usuários:", error);
      res.status(500).json({ message: error.message || "Erro ao listar usuários" });
    }
  });

  // Convidar usuário para empresa (apenas admin)
  app.post("/api/company/users/invite", authenticateToken, requireCompanyAdmin, async (req: any, res) => {
    try {
      console.log("📧 [INVITE] Criando convite");

      const companyId = req.user.companyId;
      const invitedBy = req.user.userId;
      const inviteData = createInvitationSchema.parse(req.body);

      // Verificar se o email já está na empresa
      const existingUser = await storage.getUserByEmail(inviteData.email);
      if (existingUser) {
        const existingMembership = await storage.getMembership(existingUser.id, companyId);
        if (existingMembership) {
          return res.status(400).json({
            message: "Este usuário já faz parte da empresa."
          });
        }
      }

      // Verificar se já existe um convite pendente para este email
      const existingInvitations = await storage.getInvitationsByCompanyId(companyId);
      const pendingInvite = existingInvitations.find(
        inv => inv.email === inviteData.email && inv.status === 'pending'
      );

      if (pendingInvite) {
        return res.status(400).json({
          message: "Já existe um convite pendente para este email."
        });
      }

      // Criar convite
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Convite válido por 7 dias

      const invitation = await storage.createInvitation({
        companyId,
        email: inviteData.email,
        role: inviteData.role,
        displayName: inviteData.displayName, // Nome específico para esta empresa
        token,
        status: 'pending',
        expiresAt,
        invitedBy,
      });

      // Buscar dados da empresa
      const company = await storage.getCompanyById(companyId);

      // Enviar email de convite
      const emailResult = await sendInvitationEmail(
        inviteData.email,
        company!.name,
        inviteData.role,
        token
      );

      if (!emailResult.success) {
        console.warn(`⚠️ [INVITE] Convite criado mas email não foi enviado: ${emailResult.error}`);
      }

      console.log(`✅ [INVITE] Convite criado e enviado para: ${inviteData.email}`);

      res.json({
        message: 'Convite enviado com sucesso!',
        invitation: {
          email: invitation.email,
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

  // ==================== ACEITAÇÃO DE CONVITES ====================

  // Validar convite (rota pública)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const invitation = await storage.getInvitationByToken(token);

      if (!invitation) {
        return res.status(404).json({ message: "Convite não encontrado" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Este convite já foi utilizado" });
      }

      if (invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Este convite expirou" });
      }

      // Buscar dados da empresa
      const company = await storage.getCompanyById(invitation.companyId);

      // Verificar se o email já tem usuário
      const existingUser = await storage.getUserByEmail(invitation.email);

      res.json({
        invitation: {
          email: invitation.email,
          role: invitation.role,
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

  // Aceitar convite - usuário novo (rota pública)
  app.post("/api/invitations/:token/accept-new", async (req, res) => {
    try {
      const { token } = req.params;
      const data = acceptInvitationNewUserSchema.parse(req.body);

      console.log(`🎫 [ACCEPT INVITE NEW] Novo usuário aceitando convite: ${token.substring(0, 8)}...`);

      const invitation = await storage.getInvitationByToken(data.token);

      if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        console.log(`❌ [ACCEPT INVITE NEW] Convite inválido ou expirado`);
        return res.status(400).json({ message: "Convite inválido ou expirado" });
      }

      console.log(`📋 [ACCEPT INVITE NEW] Convite encontrado:`);
      console.log(`   - ID: ${invitation.id}`);
      console.log(`   - Email: ${invitation.email}`);
      console.log(`   - Empresa: ${invitation.companyId}`);
      console.log(`   - Role: ${invitation.role}`);

      // Verificar se já existe usuário com este email
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        console.log(`⚠️ [ACCEPT INVITE NEW] Usuário já existe (ID: ${existingUser.id})`);
        return res.status(400).json({
          message: "Este email já possui uma conta. Use a opção de login."
        });
      }

      console.log(`📝 [ACCEPT INVITE NEW] Criando novo usuário...`);
      
      // Criar usuário
      const user = await storage.createUser({
        username: invitation.email.split('@')[0],
        email: invitation.email,
        password: data.password,
        name: data.name,
        emailVerified: true, // Email já foi validado pelo convite
        plan: 'basic',
        role: 'user',
      });

      console.log(`✅ [ACCEPT INVITE NEW] Usuário criado (ID: ${user.id})`);
      console.log(`📝 [ACCEPT INVITE NEW] Criando membership...`);

      // Criar membership
      const membership = await storage.createMembership({
        userId: user.id,
        companyId: invitation.companyId,
        role: invitation.role,
        isActive: true,
      });

      console.log(`✅ [ACCEPT INVITE NEW] Membership criada (ID: ${membership.id})`);

      // Marcar convite como aceito
      await storage.updateInvitationStatus(invitation.id, 'accepted');

      console.log(`✅ [ACCEPT INVITE NEW] Convite marcado como aceito`);

      // Gerar token JWT
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

      console.log(`✅ [ACCEPT INVITE NEW] Usuário criado e convite aceito: ${user.email}`);
      console.log(`   - User ID: ${user.id}`);
      console.log(`   - Empresa: ${invitation.companyId}`);
      console.log(`   - Role: ${invitation.role}`);
      console.log(`   - Membership ID: ${membership.id}`);

      res.json({
        message: 'Conta criada com sucesso!',
        token: jwtToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
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

      // Verificar se já é membro
      console.log(`🔍 [ACCEPT EXISTING] Verificando membership existente...`);
      console.log(`   - User ID: ${req.user.userId}`);
      console.log(`   - Company ID: ${invitation.companyId}`);
      
      const existingMembership = await storage.getMembership(req.user.userId, invitation.companyId);
      
      if (existingMembership) {
        console.log(`⚠️ [ACCEPT EXISTING] ERRO: Usuário já possui membership!`);
        console.log(`   - Membership ID: ${existingMembership.id}`);
        console.log(`   - Role: ${existingMembership.role}`);
        console.log(`   - Ativo: ${existingMembership.isActive}`);
        return res.status(400).json({
          message: "Você já faz parte desta empresa."
        });
      }

      console.log(`✅ [ACCEPT EXISTING] Nenhuma membership existente encontrada`);
      console.log(`📝 [ACCEPT EXISTING] INICIANDO CRIAÇÃO DA MEMBERSHIP...`);
      
      // Criar membership
      console.log(`🏗️ [ACCEPT EXISTING] Dados para criar membership:`);
      console.log(`   - userId: ${req.user.userId}`);
      console.log(`   - companyId: ${invitation.companyId}`);
      console.log(`   - role: ${invitation.role}`);
      console.log(`   - displayName: ${invitation.displayName || 'null (usa users.name)'}`);
      console.log(`   - isActive: true`);
      
      const membership = await storage.createMembership({
        userId: req.user.userId,
        companyId: invitation.companyId,
        role: invitation.role,
        displayName: invitation.displayName, // Nome específico da empresa
        isActive: true,
      });

      console.log(`✅ [ACCEPT EXISTING] MEMBERSHIP CRIADA COM SUCESSO!`);
      console.log(`   - Membership ID: ${membership.id}`);
      console.log(`   - User ID: ${membership.userId}`);
      console.log(`   - Company ID: ${membership.companyId}`);
      console.log(`   - Role: ${membership.role}`);
      console.log(`   - Ativo: ${membership.isActive}`);

      // Marcar convite como aceito
      console.log(`🔄 [ACCEPT EXISTING] Atualizando status do convite...`);
      console.log(`   - Invitation ID: ${invitation.id}`);
      console.log(`   - Status atual: ${invitation.status}`);
      console.log(`   - Novo status: accepted`);
      
      const updatedInvitation = await storage.updateInvitationStatus(invitation.id, 'accepted');

      console.log(`✅ [ACCEPT EXISTING] CONVITE ATUALIZADO COM SUCESSO!`);
      console.log(`   - Invitation ID: ${updatedInvitation.id}`);
      console.log(`   - Novo status: ${updatedInvitation.status}`);

      console.log(`\n========================================`);
      console.log(`✅ [ACCEPT EXISTING] PROCESSO CONCLUÍDO COM SUCESSO!`);
      console.log(`========================================`);
      console.log(`   - Usuário: ${req.user.email}`);
      console.log(`   - Empresa: ${invitation.companyId}`);
      console.log(`   - Membership ID: ${membership.id}`);
      console.log(`   - Invitation atualizada: ${updatedInvitation.id}`);
      console.log(`========================================\n`);

      console.log(`📤 [ACCEPT EXISTING] Enviando resposta para o frontend...`);
      
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
      
      console.log(`📤 [ACCEPT EXISTING] Response body:`, response);
      
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
