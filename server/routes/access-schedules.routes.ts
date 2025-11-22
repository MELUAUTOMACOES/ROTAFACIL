import type { Express } from "express";
import { storage } from "../storage";
import { insertAccessScheduleSchema } from "@shared/schema";
import { isAccessAllowed, getMinutesUntilEndOfShift, getAccessDeniedMessage } from "../access-schedule-validator";

// Middleware para verificar se é admin
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(403).json({ message: 'Acesso negado. Você precisa estar autenticado.' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Acesso negado. Apenas administradores podem gerenciar tabelas de horário.',
      currentRole: req.user.role,
      requiredRole: 'admin'
    });
  }
  
  next();
}

export function registerAccessSchedulesRoutes(app: Express, authenticateToken: any) {
  
  // Verificar se o usuário logado ainda tem permissão de acesso no horário atual
  // Este endpoint é chamado periodicamente pelo frontend
  app.get("/api/check-access", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      
      if (!user) {
        return res.status(403).json({ 
          allowed: false,
          message: "Usuário não encontrado"
        });
      }
      
      // Se não tem tabela de horário, acesso sempre permitido
      if (!user.accessScheduleId) {
        return res.json({ 
          allowed: true,
          minutesUntilEnd: null
        });
      }
      
      // Buscar tabela de horário (sem filtrar por userId, pois a tabela pertence ao admin)
      const schedule = await storage.getAccessScheduleById(user.accessScheduleId);
      
      if (!schedule) {
        return res.json({ 
          allowed: true,
          minutesUntilEnd: null
        });
      }
      
      // Verificar se acesso é permitido no horário atual
      const allowed = isAccessAllowed(schedule);
      
      if (!allowed) {
        console.log(`❌ [CHECK-ACCESS] Acesso negado para ${user.email} - fora do horário`);
        return res.status(403).json({ 
          allowed: false,
          message: getAccessDeniedMessage(schedule)
        });
      }
      
      // Calcular minutos até o fim do expediente
      const minutesUntilEnd = getMinutesUntilEndOfShift(schedule);
      
      res.json({ 
        allowed: true,
        minutesUntilEnd,
        scheduleName: schedule.name
      });
      
    } catch (error: any) {
      console.error("❌ [CHECK-ACCESS] Erro ao verificar acesso:", error);
      res.status(500).json({ 
        allowed: true, // Em caso de erro, não bloquear
        minutesUntilEnd: null
      });
    }
  });
  
  // Listar todas as tabelas de horário (apenas admin)
  app.get("/api/access-schedules", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const schedules = await storage.getAccessSchedules(req.user.userId);
      res.json(schedules);
    } catch (error: any) {
      console.error("❌ Erro ao listar tabelas de horário:", error);
      res.status(500).json({ message: error.message || "Erro ao listar tabelas de horário" });
    }
  });
  
  // Buscar tabela de horário específica (apenas admin)
  app.get("/api/access-schedules/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const schedule = await storage.getAccessSchedule(scheduleId, req.user.userId);
      
      if (!schedule) {
        return res.status(404).json({ message: "Tabela de horário não encontrada" });
      }
      
      res.json(schedule);
    } catch (error: any) {
      console.error("❌ Erro ao buscar tabela de horário:", error);
      res.status(500).json({ message: error.message || "Erro ao buscar tabela de horário" });
    }
  });
  
  // Criar nova tabela de horário (apenas admin)
  app.post("/api/access-schedules", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      console.log("📝 [ACCESS SCHEDULES] Criando nova tabela de horário");
      console.log("Dados recebidos:", req.body);
      
      const scheduleData = insertAccessScheduleSchema.parse(req.body);
      
      const schedule = await storage.createAccessSchedule(scheduleData, req.user.userId);
      
      console.log(`✅ [ACCESS SCHEDULES] Tabela de horário criada: ${schedule.name} (ID: ${schedule.id})`);
      
      res.json(schedule);
    } catch (error: any) {
      console.error("❌ Erro ao criar tabela de horário:", error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Dados inválidos. Verifique todos os campos obrigatórios.",
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: error.message || "Erro ao criar tabela de horário" });
    }
  });
  
  // Atualizar tabela de horário (apenas admin)
  app.put("/api/access-schedules/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      console.log(`📝 [ACCESS SCHEDULES] Atualizando tabela de horário ID: ${scheduleId}`);
      
      // Validação parcial para updates
      const scheduleData = req.body;
      
      const schedule = await storage.updateAccessSchedule(scheduleId, scheduleData, req.user.userId);
      
      console.log(`✅ [ACCESS SCHEDULES] Tabela de horário atualizada: ${schedule.name}`);
      
      res.json(schedule);
    } catch (error: any) {
      console.error("❌ Erro ao atualizar tabela de horário:", error);
      res.status(500).json({ message: error.message || "Erro ao atualizar tabela de horário" });
    }
  });
  
  // Deletar tabela de horário (apenas admin)
  app.delete("/api/access-schedules/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      
      console.log(`🗑️ [ACCESS SCHEDULES] Deletando tabela de horário ID: ${scheduleId}`);
      
      const success = await storage.deleteAccessSchedule(scheduleId, req.user.userId);
      
      if (!success) {
        return res.status(404).json({ message: "Tabela de horário não encontrada" });
      }
      
      console.log(`✅ [ACCESS SCHEDULES] Tabela de horário deletada: ID ${scheduleId}`);
      
      res.json({ message: "Tabela de horário deletada com sucesso" });
    } catch (error: any) {
      console.error("❌ Erro ao deletar tabela de horário:", error);
      res.status(500).json({ message: error.message || "Erro ao deletar tabela de horário" });
    }
  });
}
