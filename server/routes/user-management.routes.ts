import type { Express } from "express";
import crypto from "crypto";
import { storage } from "../storage";
import { sendVerificationEmail, sendTestEmail, sendPasswordResetEmail } from "../email";
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
  
  // Listar todos os usuários (apenas admin)
  app.get("/api/users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      // 🔒 CRÍTICO: Filtrar apenas usuários criados pelo admin logado para garantir isolamento
      const users = await storage.getAllUsers(req.user.userId);
      
      // Não enviar passwords no response
      const sanitizedUsers = users.map(({ password, emailVerificationToken, ...user }) => user);
      
      res.json(sanitizedUsers);
    } catch (error: any) {
      console.error("❌ Erro ao listar usuários:", error);
      res.status(500).json({ message: error.message || "Erro ao listar usuários" });
    }
  });
  
  // Criar novo usuário (apenas admin)
  app.post("/api/users", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      console.log("📝 [USER MANAGEMENT] Criando novo usuário");
      console.log("Dados recebidos:", req.body);
      
      const userData = createUserByAdminSchema.parse(req.body);
      
      // Verificar se email já existe
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Este email já está cadastrado no sistema." 
        });
      }
      
      // Criar usuário com senha temporária
      const user = await storage.createUserByAdmin(userData, req.user.userId);
      
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
  
  // Deletar usuário (apenas admin)
  app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Não permitir que admin delete a si mesmo
      if (userId === req.user.userId) {
        return res.status(400).json({ 
          message: "Você não pode deletar sua própria conta." 
        });
      }
      
      console.log(`🗑️ [USER MANAGEMENT] Deletando usuário ID: ${userId}`);
      
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
