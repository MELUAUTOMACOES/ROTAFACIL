import type { Express } from "express";
import crypto from "crypto";
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
  
  // Criar nova empresa + administrador (rota pública)
  app.post("/api/auth/signup-company", async (req, res) => {
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
        plan: 'free',
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
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: membership.role,
            isActive: membership.isActive,
            emailVerified: user.emailVerified,
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
      
      console.log(`🎫 [ACCEPT INVITE] Novo usuário aceitando convite: ${token.substring(0, 8)}...`);
      
      const invitation = await storage.getInvitationByToken(data.token);
      
      if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Convite inválido ou expirado" });
      }
      
      // Verificar se já existe usuário com este email
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Este email já possui uma conta. Use a opção de login." 
        });
      }
      
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
      
      // Criar membership
      await storage.createMembership({
        userId: user.id,
        companyId: invitation.companyId,
        role: invitation.role,
        isActive: true,
      });
      
      // Marcar convite como aceito
      await storage.updateInvitationStatus(invitation.id, 'accepted');
      
      // Gerar token JWT
      const jwtToken = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          companyId: invitation.companyId,
          companyRole: invitation.role,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      console.log(`✅ [ACCEPT INVITE] Usuário criado e convite aceito: ${user.email}`);
      
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
      const data = acceptInvitationExistingUserSchema.parse(req.body);
      
      console.log(`🎫 [ACCEPT INVITE] Usuário existente aceitando convite`);
      
      const invitation = await storage.getInvitationByToken(data.token);
      
      if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Convite inválido ou expirado" });
      }
      
      // Verificar se o email do convite corresponde ao usuário logado
      if (invitation.email !== req.user.email) {
        return res.status(403).json({ 
          message: "Este convite não foi enviado para você." 
        });
      }
      
      // Verificar se já é membro
      const existingMembership = await storage.getMembership(req.user.userId, invitation.companyId);
      if (existingMembership) {
        return res.status(400).json({ 
          message: "Você já faz parte desta empresa." 
        });
      }
      
      // Criar membership
      await storage.createMembership({
        userId: req.user.userId,
        companyId: invitation.companyId,
        role: invitation.role,
        isActive: true,
      });
      
      // Marcar convite como aceito
      await storage.updateInvitationStatus(invitation.id, 'accepted');
      
      console.log(`✅ [ACCEPT INVITE] Convite aceito por usuário existente: ${req.user.email}`);
      
      res.json({
        message: 'Convite aceito com sucesso!',
        companyId: invitation.companyId,
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
}
