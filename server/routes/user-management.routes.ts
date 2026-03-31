import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { sendVerificationEmail, sendTestEmail, sendPasswordResetEmail } from "../email";
import { sendInvitationEmail } from "../email-invitation";
import { 
  createUserByAdminSchema, 
  updateUserByAdminSchema,
  verifyEmailSchema,
  setFirstPasswordSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "@shared/schema";

// Middleware para verificar se é admin
function requireAdmin(req: any, res: any, next: any) {
  console.log('🔐 [AUTH] Verificando permissão de admin...');
  console.log('📋 [AUTH] Usuário na requisição:', req.user ? {
    id: req.user.id,
    email: req.user.email,
    role: req.user.role
  } : 'NENHUM USUÁRIO');
  
  if (!req.user) {
    console.log('❌ [AUTH] Falha: Nenhum usuário autenticado');
    return res.status(403).json({ message: 'Acesso negado. Você precisa estar autenticado.' });
  }
  
  if (req.user.role !== 'admin') {
    console.log(`❌ [AUTH] Falha: Usuário ${req.user.email} tem role="${req.user.role}" mas precisa ser "admin"`);
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas administradores podem realizar esta ação.',
      currentRole: req.user.role,
      requiredRole: 'admin'
    });
  }
  
  console.log(`✅ [AUTH] Sucesso: Usuário ${req.user.email} é admin`);
  next();
}

// Função auxiliar para gerar token de verificação
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function registerUserManagementRoutes(app: Express, authenticateToken: any) {
  
  // ==================== ROTAS DE GESTÃO DE USUÁRIOS (ADMIN) ====================
  
  // Listar todos os usuários da empresa (apenas admin)
  app.get("/api/users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      
      console.log(`📋 [LIST USERS] Admin ${req.user.email} listando usuários`);
      console.log(`   - Company ID: ${companyId || 'N/A'}`);
      
      if (companyId) {
        // 🔒 MULTI-TENANT: Listar usuários da empresa via memberships
        console.log(`🔍 [LIST USERS] Buscando usuários com memberships ativas na empresa ${companyId}...`);
        
        const companyUsers = await storage.getUsersByCompanyId(companyId);
        
        console.log(`✅ [LIST USERS] Encontrados ${companyUsers.length} usuários com membership ativa`);
        console.log(`⚠️  [LIST USERS] ATENÇÃO: Esta listagem NÃO inclui convites pendentes!`);
        console.log(`   Use GET /api/company/users para ver convites pendentes também.`);
        
        const sanitizedUsers = companyUsers.map(({ password, emailVerificationToken, ...user }: any) => user);
        return res.json(sanitizedUsers);
      }
      
      // Fallback: Se admin não tem companyId (legado), usar createdBy
      console.log(`🔍 [LIST USERS] Modo legado - buscando por createdBy=${req.user.userId}`);
      const users = await storage.getAllUsers(req.user.userId);
      console.log(`✅ [LIST USERS] Encontrados ${users.length} usuários`);
      
      const sanitizedUsers = users.map(({ password, emailVerificationToken, ...user }) => user);
      res.json(sanitizedUsers);
    } catch (error: any) {
      console.error("❌ Erro ao listar usuários:", error);
      res.status(500).json({ message: error.message || "Erro ao listar usuários" });
    }
  });
  
  // Criar novo usuário (apenas admin) — MULTI-TENANT
  app.post("/api/users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      console.log("📝 [USER MANAGEMENT] Criando novo usuário");
      console.log("Dados recebidos:", req.body);
      
      const userData = createUserByAdminSchema.parse(req.body);
      const adminCompanyId = req.user.companyId;
      
      // Verificar se email já existe no sistema
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        console.log(`📋 [USER MANAGEMENT] E-mail já existe no sistema: ${existingUser.email} (ID: ${existingUser.id})`);
        console.log(`   - Email verificado: ${existingUser.emailVerified}`);
        console.log(`   - Ativo: ${existingUser.isActive}`);
        
        // 🏢 MULTI-TENANT: Usuário já existe — verificar isolamento por empresa
        if (adminCompanyId) {
          // 1. Já é membro desta empresa?
          const existingMembership = await storage.getMembership(existingUser.id, adminCompanyId);
          if (existingMembership) {
            console.log(`⚠️ [USER MANAGEMENT] Usuário já possui membership na empresa ${adminCompanyId}`);
            return res.status(400).json({ 
              message: "Este usuário já pertence à sua empresa." 
            });
          }
          
          console.log(`🔍 [USER MANAGEMENT] Usuário existe em outra empresa. Verificando convites...`);
          
          // 2. Usuário existe em OUTRA empresa — NÃO criar membership diretamente.
          // ✅ Fluxo correto: criar convite pendente e enviar e-mail para aceite.
          //    Membership só é criada após o usuário aceitar o convite.
          
          // Verificar se já existe convite pendente para este e-mail nesta empresa
          const existingInvitations = await storage.getInvitationsByCompanyId(adminCompanyId);
          const pendingInvite = existingInvitations.find(
            inv => inv.email === existingUser.email && inv.status === 'pending'
          );
          if (pendingInvite) {
            console.log(`⚠️ [USER MANAGEMENT] Convite pendente já existe (ID: ${pendingInvite.id})`);
            return res.status(400).json({
              message: "Já existe um convite pendente para este e-mail nesta empresa. Aguarde o usuário aceitar.",
            });
          }
          
          // Mapear role do formulário para role de membership
          const inviteRole = userData.role === 'admin' ? 'ADMIN'
            : userData.role === 'operador' ? 'OPERADOR'
            : (userData.role === 'prestador' || userData.role === 'tecnico') ? 'OPERADOR'
            : 'ADMINISTRATIVO';
          
          // Criar convite com token único
          const inviteToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // Válido por 7 dias
          
          console.log(`📧 [USER MANAGEMENT] Criando convite para usuário existente...`);
          console.log(`   - Email: ${existingUser.email}`);
          console.log(`   - Empresa: ${adminCompanyId}`);
          console.log(`   - Role: ${inviteRole}`);
          
          const invitation = await storage.createInvitation({
            companyId: adminCompanyId,
            email: existingUser.email,
            role: inviteRole,
            token: inviteToken,
            status: 'pending',
            expiresAt,
            invitedBy: req.user.userId,
          });
          
          console.log(`✅ [USER MANAGEMENT] Convite criado com sucesso (ID: ${invitation.id})`);
          
          // Enviar e-mail de convite para o usuário
          const company = await storage.getCompanyById(adminCompanyId);
          const emailResult = await sendInvitationEmail(
            existingUser.email,
            company?.name || 'sua empresa',
            inviteRole,
            inviteToken
          );
          
          if (!emailResult.success) {
            console.warn(`⚠️ [USER MANAGEMENT] Convite criado mas e-mail não foi enviado: ${emailResult.error}`);
          } else {
            console.log(`✅ [USER MANAGEMENT] E-mail de convite enviado com sucesso`);
          }
          
          console.log(`📧 [USER MANAGEMENT] Convite enviado para ${existingUser.email} → empresa ${adminCompanyId}. Aguardando aceite.`);
          console.log(`🔗 [USER MANAGEMENT] Token do convite: ${inviteToken.substring(0, 8)}...`);
          
          return res.json({ 
            message: 'Este e-mail já possui conta na plataforma. Um convite foi enviado para que o usuário aceite o vínculo com sua empresa.',
            inviteSent: true,
            invitation: {
              id: invitation.id,
              email: invitation.email,
              role: invitation.role,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
            }
          });
        }
        
        // Sem companyId (legado) — manter comportamento antigo
        return res.status(400).json({ 
          message: "Este email já está cadastrado no sistema." 
        });
      }
      
      // Usuário NÃO existe — criar user + membership
      const user = await storage.createUserByAdmin(userData, req.user.userId);
      
      // 🏢 MULTI-TENANT: Criar membership na empresa do admin
      if (adminCompanyId) {
        await storage.createMembership({
          userId: user.id,
          companyId: adminCompanyId,
          role: userData.role === 'admin' ? 'ADMIN' : userData.role === 'operador' ? 'OPERADOR' : (userData.role === 'prestador' || userData.role === 'tecnico') ? 'OPERADOR' : 'ADMINISTRATIVO',
        });
        console.log(`🏢 [USER MANAGEMENT] Membership criada para user ${user.id} na empresa ${adminCompanyId}`);
      }
      
      // Gerar token de verificação de email
      const token = generateVerificationToken();
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24); // Token válido por 24 horas
      
      await storage.setEmailVerificationToken(user.id, token, expiry);
      
      // Enviar email de verificação
      const emailResult = await sendVerificationEmail(user.email, user.name, token, false);
      
      if (!emailResult.success) {
        console.warn(`⚠️ [USER MANAGEMENT] Usuário criado mas email não foi enviado: ${emailResult.error}`);
      }
      
      console.log(`✅ [USER MANAGEMENT] Usuário criado: ${user.email} (ID: ${user.id})`);
      
      // Não enviar password no response
      const { password, emailVerificationToken, ...sanitizedUser } = user;
      
      res.json({ 
        user: sanitizedUser,
        message: 'Usuário criado com sucesso. Um email de verificação foi enviado.' 
      });
    } catch (error: any) {
      console.error("❌ Erro ao criar usuário:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos. Verifique todos os campos obrigatórios.",
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Erro ao criar usuário" });
    }
  });
  
  // Atualizar usuário (apenas admin)
  app.put("/api/users/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`📝 [USER MANAGEMENT] Atualizando usuário ID: ${userId}`);
      
      const userData = updateUserByAdminSchema.parse(req.body);
      
      const user = await storage.updateUserByAdmin(userId, userData);
      
      console.log(`✅ [USER MANAGEMENT] Usuário atualizado: ${user.email}`);
      
      // Não enviar password no response
      const { password, emailVerificationToken, ...sanitizedUser } = user;
      
      res.json(sanitizedUser);
    } catch (error: any) {
      console.error("❌ Erro ao atualizar usuário:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos.",
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Erro ao atualizar usuário" });
    }
  });
  
  // Deletar usuário da empresa (apenas admin) — MULTI-TENANT
  app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const adminCompanyId = req.user.companyId;
      
      // Não permitir que admin delete a si mesmo
      if (userId === req.user.userId) {
        return res.status(400).json({ 
          message: "Você não pode remover sua própria conta." 
        });
      }
      
      if (adminCompanyId) {
        // 🏢 MULTI-TENANT: Remover membership da empresa, NÃO deletar o user
        const membership = await storage.getMembership(userId, adminCompanyId);
        if (!membership) {
          return res.status(404).json({ message: "Usuário não encontrado nesta empresa" });
        }
        
        await storage.deleteMembership(userId, adminCompanyId);
        
        console.log(`🏢 [USER MANAGEMENT] Membership removida: user ${userId} da empresa ${adminCompanyId}`);
        
        // Verificar se o user ainda tem memberships em outras empresas
        const remainingMemberships = await storage.getMembershipsByUserId(userId);
        if (remainingMemberships.length === 0) {
          // Sem mais empresas — desativar o usuário (soft delete)
          await storage.updateUserByAdmin(userId, { isActive: false });
          console.log(`⚠️ [USER MANAGEMENT] Usuário ${userId} desativado (sem mais empresas)`);
        }
        
        return res.json({ message: "Usuário removido da empresa com sucesso" });
      }
      
      // Fallback legado: hard delete
      console.log(`🗑️ [USER MANAGEMENT] Deletando usuário ID: ${userId} (modo legado)`);
      
      const success = await storage.deleteUser(userId);
      
      if (!success) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      console.log(`✅ [USER MANAGEMENT] Usuário deletado: ID ${userId}`);
      
      res.json({ message: "Usuário deletado com sucesso" });
    } catch (error: any) {
      console.error("❌ Erro ao deletar usuário:", error);
      res.status(500).json({ message: error.message || "Erro ao deletar usuário" });
    }
  });
  
  // Reenviar email de verificação (apenas admin)
  app.post("/api/users/:id/resend-verification", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      if (user.emailVerified) {
        return res.status(400).json({ message: "Email já foi verificado" });
      }
      
      // Gerar novo token
      const token = generateVerificationToken();
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 24);
      
      await storage.setEmailVerificationToken(userId, token, expiry);
      
      // Reenviar email de verificação (isResend = true para usar template de reenvio)
      const emailResult = await sendVerificationEmail(user.email, user.name, token, true);
      
      if (!emailResult.success) {
        console.error(`❌ [USER MANAGEMENT] Erro ao reenviar email: ${emailResult.error}`);
        return res.status(500).json({ message: 'Erro ao enviar email de verificação.' });
      }
      
      console.log(`📧 [USER MANAGEMENT] Email de verificação reenviado para: ${user.email}`);
      
      res.json({ message: 'Email de verificação reenviado com sucesso.' });
    } catch (error: any) {
      console.error("❌ Erro ao reenviar email:", error);
      res.status(500).json({ message: error.message || "Erro ao reenviar email" });
    }
  });
  
  // ==================== ROTAS PÚBLICAS (SEM AUTENTICAÇÃO) ====================
  
  // Verificar email (rota pública)
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = verifyEmailSchema.parse(req.body);
      
      console.log(`🔍 [EMAIL VERIFICATION] Verificando token: ${token.substring(0, 8)}...`);
      
      const user = await storage.verifyEmail(token);
      
      if (!user) {
        return res.status(400).json({ 
          message: "Token inválido ou expirado. Solicite um novo email de verificação." 
        });
      }
      
      console.log(`✅ [EMAIL VERIFICATION] Email verificado: ${user.email}`);
      
      res.json({ 
        message: "Email verificado com sucesso! Agora você pode definir sua senha.",
        userId: user.id,
        email: user.email,
        requirePasswordChange: user.requirePasswordChange
      });
    } catch (error: any) {
      console.error("❌ Erro na verificação de email:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Token inválido" });
      }
      
      res.status(500).json({ message: error.message || "Erro ao verificar email" });
    }
  });
  
  // Definir primeira senha (rota pública - após verificação de email)
  app.post("/api/auth/set-first-password", async (req, res) => {
    try {
      const { token, password } = setFirstPasswordSchema.parse(req.body);
      
      console.log(`🔐 [SET PASSWORD] Definindo primeira senha para token: ${token.substring(0, 8)}...`);
      
      // Buscar usuário pelo token (mesmo após verificado, guardamos temporariamente)
      const user = await storage.getUserByVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ 
          message: "Token inválido. Por favor, solicite um novo email de verificação." 
        });
      }
      
      if (!user.emailVerified) {
        return res.status(400).json({ 
          message: "Email ainda não verificado. Verifique seu email primeiro." 
        });
      }
      
      // Atualizar senha e marcar como não precisando mais trocar
      await storage.updatePassword(user.id, password);
      await storage.setRequirePasswordChange(user.id, false);
      
      // Limpar token de verificação
      await storage.setEmailVerificationToken(user.id, '', new Date(0));
      
      console.log(`✅ [SET PASSWORD] Senha definida com sucesso para: ${user.email}`);
      
      res.json({ 
        message: "Senha definida com sucesso! Você já pode fazer login.",
        email: user.email
      });
    } catch (error: any) {
      console.error("❌ Erro ao definir senha:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos. Verifique os requisitos de senha.",
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Erro ao definir senha" });
    }
  });
  
  // Trocar senha (usuário autenticado)
  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      
      console.log(`🔐 [CHANGE PASSWORD] Usuário ${req.user.email} solicitando troca de senha`);
      
      // Verificar senha atual
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isValid) {
        return res.status(400).json({ message: "Senha atual incorreta" });
      }
      
      // Atualizar para nova senha
      await storage.updatePassword(user.id, newPassword);
      
      // Se estava com requirePasswordChange, remover
      if (user.requirePasswordChange) {
        await storage.setRequirePasswordChange(user.id, false);
      }
      
      console.log(`✅ [CHANGE PASSWORD] Senha alterada com sucesso para: ${user.email}`);
      
      res.json({ message: "Senha alterada com sucesso!" });
    } catch (error: any) {
      console.error("❌ Erro ao trocar senha:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos. Verifique os requisitos de senha.",
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Erro ao trocar senha" });
    }
  });
  
  // ==================== ROTA DE TESTE DE EMAIL (APENAS DESENVOLVIMENTO) ====================
  
  app.get("/api/test-email", authenticateToken, async (req: any, res) => {
    try {
      console.log(`📧 [TEST] Enviando email de teste para: ${req.user.email}`);
      
      const result = await sendTestEmail(req.user.email);
      
      if (result.success) {
        res.json({ 
          message: "✅ Email de teste enviado com sucesso! Verifique sua caixa de entrada.",
          email: req.user.email
        });
      } else {
        res.status(500).json({ 
          message: "❌ Erro ao enviar email de teste",
          error: result.error
        });
      }
    } catch (error: any) {
      console.error("❌ [TEST] Erro ao enviar email de teste:", error);
      res.status(500).json({ message: error.message || "Erro ao testar email" });
    }
  });
  
  // ==================== RECUPERAÇÃO DE SENHA ====================
  
  // Solicitar recuperação de senha (rota pública)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      
      console.log(`🔑 [FORGOT PASSWORD] Solicitação para: ${email}`);
      
      // Buscar usuário por email
      const user = await storage.getUserByEmail(email);
      
      // Se usuário não existe, retornar sucesso mesmo assim (segurança)
      // Não revelar se o email está cadastrado ou não
      if (!user) {
        console.log(`⚠️ [FORGOT PASSWORD] Email não encontrado: ${email}`);
        return res.json({ 
          message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha." 
        });
      }
      
      // Verificar se usuário está ativo
      if (!user.isActive) {
        console.log(`⚠️ [FORGOT PASSWORD] Usuário inativo: ${email}`);
        return res.json({ 
          message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha." 
        });
      }
      
      // Gerar token de recuperação
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 1); // Token válido por 1 hora
      
      await storage.setPasswordResetToken(user.id, token, expiry);
      
      // Enviar email
      const emailResult = await sendPasswordResetEmail(user.email, user.name, token);
      
      if (!emailResult.success) {
        console.error(`❌ [FORGOT PASSWORD] Erro ao enviar email: ${emailResult.error}`);
        return res.status(500).json({ 
          message: "Erro ao enviar email de recuperação. Tente novamente mais tarde." 
        });
      }
      
      console.log(`✅ [FORGOT PASSWORD] Email de recuperação enviado para: ${email}`);
      
      res.json({ 
        message: "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha." 
      });
    } catch (error: any) {
      console.error("❌ Erro ao solicitar recuperação de senha:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Email inválido" });
      }
      
      res.status(500).json({ message: error.message || "Erro ao processar solicitação" });
    }
  });
  
  // Redefinir senha com token (rota pública)
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      
      console.log(`🔐 [RESET PASSWORD] Redefinindo senha para token: ${token.substring(0, 8)}...`);
      
      const user = await storage.resetPassword(token, password);
      
      if (!user) {
        return res.status(400).json({ 
          message: "Token inválido ou expirado. Solicite uma nova recuperação de senha." 
        });
      }
      
      console.log(`✅ [RESET PASSWORD] Senha redefinida com sucesso para: ${user.email}`);
      
      res.json({ 
        message: "Senha redefinida com sucesso! Você já pode fazer login.",
        email: user.email
      });
    } catch (error: any) {
      console.error("❌ Erro ao redefinir senha:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos. Verifique os requisitos de senha.",
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Erro ao redefinir senha" });
    }
  });
}
