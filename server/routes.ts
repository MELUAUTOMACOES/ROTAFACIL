import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import crypto from "node:crypto"; // para randomUUID
import { db } from "./db"; // ajuste o caminho se o seu db estiver noutro arquivo
import {
  routes, routeStops, appointments, clients, clientAddresses, users, dailyAvailability, vehicleChecklists, vehicleChecklistItems, teamMembers, pendingResolutions, appointmentHistory,
  routeOccurrences,
  trackingLocations,
  businessRules,
  vehicleAssignments,
  technicians,
  teams
} from "@shared/schema";
import { asc, desc, eq, inArray, sql, and, or, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { format } from "date-fns";
import {
  insertUserSchema, loginSchema, insertClientSchema, insertServiceSchema,
  insertTechnicianSchema, insertVehicleSchema, insertAppointmentSchema,
  insertChecklistSchema, insertBusinessRulesSchema, insertTeamSchema,
  insertTeamMemberSchema, extendedInsertAppointmentSchema,
  insertVehicleChecklistSchema, insertVehicleChecklistItemSchema,
  insertVehicleMaintenanceSchema,
  insertClientAddressSchema,
  type InsertVehicle
} from "@shared/schema";
import {
  validateTechnicianTeamConflict,
  updateAvailabilityForAppointment,
  updateDailyAvailability,
  validateDateRestriction,
} from "./availability-helpers";
import { requireCompanyId } from "./utils/tenant";
import { validateWorkSchedule } from "./work-schedule-validator";
import { registerUserManagementRoutes } from "./routes/user-management.routes";
import { registerAccessSchedulesRoutes } from "./routes/access-schedules.routes";
import { registerDateRestrictionsRoutes } from "./routes/date-restrictions.routes";
import { registerCompanyRoutes } from "./routes/company.routes";
import { registerVehicleExtensionRoutes } from "./routes/vehicle-extensions.routes";
import { registerMetricsRoutes, trackFeatureUsage } from "./routes/metrics.routes";
import { registerAuditRoutes } from "./routes/audit.routes";
import { registerDashboardRoutes } from "./routes/dashboard.routes";
import { registerAdsMetricsRoutes } from "./routes/ads-metrics.routes";
import { registerSuperadminRoutes } from "./routes/superadmin.routes";
import { registerLeadsRoutes } from "./routes/leads.routes";
import { trackCompanyAudit, getAuditDescription } from "./audit.helpers";
import { isAccessAllowed, getAccessDeniedMessage } from "./access-schedule-validator";
import { requireLgpdAccepted } from "./middleware/lgpd.middleware";
import { requireRole } from "./middleware/role.middleware";
import { validateActiveMembership } from "./middleware/membership.middleware";
import { LGPD_VERSION } from "@shared/constants";
import { formatDateForSQLComparison, nowInSaoPaulo } from "./timezone-helper";
import {
  haversineDistance as osrmHaversineDistance,
  calculateOSRMDistance,
  calculateInsertionDelta,
  haversinePreFilter,
  osrmStats,
  type Coords
} from "./osrm-distance-helper";
import { getPlanLimits } from "@shared/plan-limits";
import { companies } from "@shared/schema";
import { logEgressSize } from "./utils/egressLogger";

// 🛡️ Rate Limiting para Login (previne brute force)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 tentativas por janela
  message: { message: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔐 CONFIGURAÇÃO OBRIGATÓRIA: JWT_SECRET deve estar definido nas variáveis de ambiente
// Esta chave é usada para assinar e verificar tokens de autenticação
const JWT_SECRET = process.env.JWT_SECRET || "development_jwt_secret_key_32_characters_long_minimum_for_security_rotafacil_2025";

// 🔐 CONFIGURAÇÃO: URL do OSRM (Open Source Routing Machine)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getOsrmUrl() {
  // 1. Prioridade: Variável de ambiente (Ideal para Deploy/Render)
  if (process.env.OSRM_URL) {
    return process.env.OSRM_URL;
  }

  // 2. Fallback: Arquivo txt em vários locais possíveis
  const candidates = [
    path.join(__dirname, 'osrm_url.txt'),
    path.join(process.cwd(), 'server/osrm_url.txt'),
    path.join(process.cwd(), 'osrm_url.txt'),
  ];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        console.log("Arquivo de configuração OSRM encontrado em:", filePath);
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    } catch (err) {
      // continua procurando
    }
  }

  console.error('Arquivo osrm_url.txt não encontrado em nenhum local padrão.');
  return null;
}

// 🔐 CONFIGURAÇÃO: Versão do Sistema (Usado para forçar logout global)
const getSystemVersion = () => process.env.SYSTEM_VERSION || "1.0.0";

// Auth middleware
function authenticateToken(req: any, res: any, next: any) {
  // 🚨 DEV MODE BYPASS: ⚠️ PERIGO! Permite acesso sem autenticação durante desenvolvimento
  // ⚠️ ATENÇÃO CRÍTICA: NUNCA usar em produção ou com banco de dados real!
  // ⚠️ Com DEV_MODE=true, TODOS os usuários viram admin automaticamente!
  if (process.env.DEV_MODE === 'true') {
    console.warn('');
    console.warn('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
    console.warn('🚨 ALERTA DE SEGURANÇA: DEV_MODE ATIVO! 🚨');
    console.warn('⚠️  TODOS OS USUÁRIOS ESTÃO SENDO TRATADOS COMO ADMIN!');
    console.warn('⚠️  DESATIVE IMEDIATAMENTE EM PRODUÇÃO!');
    console.warn('⚠️  Defina DEV_MODE=false no arquivo .env');
    console.warn('⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️');
    console.warn('');

    // Criar usuário fake para desenvolvimento
    req.user = {
      userId: 1,
      email: 'dev@rotafacil.com',
      name: 'Dev User',
      plan: 'premium',
      role: 'admin' // DEV mode sempre admin
    };
    return next();
  }

  // 🔐 Autenticação normal para produção
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ [AUTH] Token não fornecido');
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err: any, decoded: any) => {
    if (err) {
      console.log('❌ [AUTH] Token inválido:', err.message);
      return res.status(403).json({ message: 'Invalid token' });
    }

    // Verificar se a senha foi alterada após a emissão do token
    try {
      const user = await storage.getUserById(decoded.userId);

      if (!user) {
        console.log('❌ [AUTH] Usuário não encontrado:', decoded.userId);
        return res.status(403).json({ message: 'User not found' });
      }

      // Se passwordChangedAt existe e é posterior à emissão do token (iat)
      if (user.passwordChangedAt) {
        const passwordChangedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
        const tokenIssuedAt = decoded.iat;

        if (passwordChangedTimestamp > tokenIssuedAt) {
          console.log('⚠️ [AUTH] Token inválido: senha foi alterada após emissão do token');
          console.log('📅 Token emitido em:', new Date(tokenIssuedAt * 1000).toISOString());
          console.log('🔐 Senha alterada em:', user.passwordChangedAt.toISOString());
          return res.status(403).json({
            message: 'Token expired due to password change. Please login again.'
          });
        }
      }

      // Verificar se a versão do sistema mudou
      if (decoded.sysVer && decoded.sysVer !== getSystemVersion()) {
        console.log(`⚠️ [AUTH] Token inválido: versão do sistema atualizada (${decoded.sysVer} -> ${getSystemVersion()})`);
        return res.status(401).json({ 
          message: 'O sistema foi atualizado. Faça login novamente para continuar.',
          code: 'SYSTEM_UPDATED'
        });
      }

      // Decodificar o token e adicionar ao req.user
      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user', // Importante: incluir o role
        companyId: decoded.companyId,
        companyRole: decoded.companyRole,
        isSuperAdmin: user.isSuperAdmin || false, // Flag para admin master
      };

      // Token válido - log removido para não poluir console

      // 🕒 VALIDAÇÃO DE HORÁRIO DE ACESSO
      // Se usuário tem tabela de horário configurada, verificar se pode acessar
      if (user.accessScheduleId) {
        try {
          // Buscar a tabela de horário do banco (sem filtrar por userId, pois a tabela pertence ao admin)
          const schedule = await storage.getAccessScheduleById(user.accessScheduleId);

          if (!schedule) {
            console.warn(`⚠️ [AUTH] Tabela de horário ${user.accessScheduleId} não encontrada para ${user.email}`);
            return next(); // Se não encontrar, liberar acesso
          }

          // Verificar se acesso é permitido no horário atual
          const allowed = isAccessAllowed(schedule);

          if (!allowed) {
            const message = getAccessDeniedMessage(schedule);
            console.log(`❌ [AUTH] Acesso negado para ${user.email} - ${message}`);
            return res.status(403).json({ message });
          }

          // Acesso permitido - sem log para não poluir
        } catch (error) {
          console.error(`❌ [AUTH] Erro ao verificar horário de acesso:`, error);
          // Em caso de erro, liberar acesso
        }
      }

      next();
    } catch (error) {
      console.error('❌ [AUTH] Erro ao verificar token:', error);
      return res.status(500).json({ message: 'Authentication error' });
    }
  });
}

/**
 * 🔒 MIDDLEWARE COMPOSTO PARA ROTAS DE EMPRESA
 * 
 * Combina authenticateToken + validateActiveMembership em uma única chamada.
 * Garante que:
 * 1. JWT é válido (authenticateToken)
 * 2. Membership na empresa atual está ATIVA no banco (validateActiveMembership)
 * 
 * USO (substituir authenticateToken em rotas de empresa):
 * 
 * ANTES:
 * app.get("/api/clients", authenticateToken, (req, res) => { ... });
 * 
 * DEPOIS:
 * app.get("/api/clients", authenticateCompany, (req, res) => { ... });
 * 
 * ⚠️ IMPORTANTE:
 * - Usar APENAS em rotas que dependem de req.user.companyId
 * - Para rotas globais (ex: /api/auth/me), continuar usando apenas authenticateToken
 * - Bloqueia imediatamente se membership inativa (não espera polling)
 */
const authenticateCompany = [authenticateToken, validateActiveMembership(storage)];

// ==================== GEO HELPERS (NOMINATIM) ====================

// Normaliza CEP para formato "12345-678" (aceita com ou sem traço)
function formatCep(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const clean = cep.replace(/\D/g, ''); // Remove tudo que não é número
  if (clean.length !== 8) return null; // CEP inválido
  return `${clean.substring(0, 5)}-${clean.substring(5)}`; // Formata: 12345-678
}

// Monta um endereço completo a partir do registro do AGENDAMENTO.
// Tenta cobrir diferentes nomes de campos que você possa ter no schema.
function composeFullAddressFromAppointment(a: any) {
  const street = a?.address || a?.street || a?.logradouro;
  const number = a?.number || a?.numero;
  const neighborhood = a?.neighborhood || a?.bairro || a?.district;
  const city = a?.city || a?.cidade;
  const state = a?.state || a?.uf || a?.estado;
  const zip = formatCep(a?.zip || a?.zipcode || a?.cep); // Normaliza CEP

  const parts = [
    [street, number].filter(Boolean).join(", "),
    neighborhood,
    city,
    state,
    zip,
    "Brasil"
  ].filter(Boolean);

  return parts.join(", ");
}

// Chama Nominatim e retorna { lat, lng } (numbers)
async function geocodeWithNominatim(fullAddress: string, maxRetries: number = 3) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "RotaFacil/1.0 (contato: suporte@rotafacil.app)",
          "Accept-Language": "pt-BR"
        }
      });
      
      if (!res.ok) {
        throw new Error(`Nominatim error ${res.status}`);
      }
      
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error("Nenhum resultado do Nominatim");
      }
      
      const { lat, lon } = arr[0];
      const latNum = Number(lat);
      const lngNum = Number(lon);
      
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        throw new Error("Coordenadas inválidas do Nominatim");
      }
      
      // Sucesso - retornar coordenadas
      if (attempt > 1) {
        console.log(`✅ [GEOCODE] Sucesso na tentativa ${attempt}/${maxRetries}`);
      }
      return { lat: latNum, lng: lngNum };
      
    } catch (error: any) {
      lastError = error;
      
      // Se for erro de rede (ENOTFOUND, ETIMEDOUT, etc) e não for a última tentativa, retry
      const isNetworkError = error.code === 'ENOTFOUND' || 
                            error.code === 'ETIMEDOUT' || 
                            error.code === 'ECONNREFUSED' ||
                            error.message?.includes('fetch failed');
      
      if (isNetworkError && attempt < maxRetries) {
        const delayMs = 1000 * attempt; // 1s, 2s, 3s
        console.log(`⚠️ [GEOCODE] Tentativa ${attempt}/${maxRetries} falhou (${error.message}). Aguardando ${delayMs}ms antes de tentar novamente...`);
        await sleep(delayMs);
        continue;
      }
      
      // Não é erro de rede OU é a última tentativa - propagar erro
      if (attempt === maxRetries) {
        console.log(`❌ [GEOCODE] Falha após ${maxRetries} tentativas`);
      }
      throw error;
    }
  }
  
  // Não deveria chegar aqui, mas por segurança
  throw lastError || new Error("Geocoding falhou");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== PUBLIC ROUTES (NO AUTH) ====================

  // 📊 Landing Page Analytics - Endpoint público para rastreamento de eventos
  // Rate limit mais restritivo para evitar spam/abuse
  const analyticsRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // Máximo 30 eventos por minuto por IP
    message: { message: "Too many analytics events" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.post("/api/metrics/event", analyticsRateLimiter, async (req: any, res) => {
    try {
      const { eventName, page, deviceType, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, eventData, sessionId } = req.body;

      // Validação básica
      if (!eventName || typeof eventName !== 'string') {
        return res.status(400).json({ message: "eventName é obrigatório" });
      }

      if (!page || typeof page !== 'string') {
        return res.status(400).json({ message: "page é obrigatório" });
      }

      if (!deviceType || !['mobile', 'desktop'].includes(deviceType)) {
        return res.status(400).json({ message: "deviceType deve ser 'mobile' ou 'desktop'" });
      }

      // Lista de eventos permitidos (whitelist)
      const allowedEvents = ['page_view', 'scroll_50', 'scroll_75', 'click_cta_principal', 'click_whatsapp', 'signup_start', 'signup_complete'];
      if (!allowedEvents.includes(eventName)) {
        return res.status(400).json({ message: "Evento não permitido" });
      }

      // Extrair informações do request
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

      // Salvar evento no banco
      const event = await storage.createAnalyticsEvent({
        eventName,
        page,
        deviceType,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
        eventData: eventData || null,
        sessionId: sessionId || null,
        userAgent,
        ipAddress,
      });

      // Log em desenvolvimento
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📊 [ANALYTICS] Evento registrado: ${eventName} | Page: ${page} | Device: ${deviceType} | Session: ${sessionId || 'N/A'}`);
      }

      res.status(201).json({ success: true, eventId: event.id });
    } catch (error: any) {
      console.error("❌ [ANALYTICS] Erro ao registrar evento:", error);
      // Não expor detalhes do erro para endpoint público
      res.status(500).json({ message: "Erro ao registrar evento" });
    }
  });

  // ==================== PROVIDER ROUTES ====================

  // 1. Obter rota ativa do prestador (Hoje)
  app.get("/api/provider/route", authenticateCompany, async (req: any, res) => {
    try {
      const companyId = requireCompanyId(req, res);
      if (!companyId) return;

      // 🌎 Usar horário de São Paulo (UTC-3) para comparação de data
      const dateParam = req.query.date ? new Date(req.query.date) : nowInSaoPaulo();
      let route;

      // Se passar routeId (admin selecionando rota específica)
      if (req.query.routeId) {
        const routeId = req.query.routeId as string;
        /* console.log(`🔎 [PROVIDER] Buscando rota por ID explícito: ${routeId}`); */

        // Verifica permissão: admin ou dono da rota
        const [targetRoute] = await db.select().from(routes).where(eq(routes.id, routeId));

        if (targetRoute) {
          /* console.log(`✅ [PROVIDER] Rota encontrada no DB: ${targetRoute.id} (Status: ${targetRoute.status})`); */
          // Se não for admin e não for o dono, checar se é o responsável
          const userRole = (req.user.companyRole || req.user.role || '').toLowerCase();
          if (userRole !== 'admin') {
            const isOwner = targetRoute.userId === req.user.userId;
            const isResponsible =
              (targetRoute.responsibleType === 'technician' && Number(targetRoute.responsibleId) === req.user.id) || // Assumindo map technician->user ou technician table logic
              (targetRoute.responsibleType === 'driver' && Number(targetRoute.responsibleId) === req.user.id); // Lógica simplificada

            // Por enquanto mantendo a lógica original restritiva para não quebrar outros fluxos
            // e permitindo apenas se for o criador (userId). O provider real usa o endpoint sem routeId.
            if (targetRoute.userId !== req.user.userId) {
              /* console.log(`🚫 [PROVIDER] Acesso negado. User ${req.user.userId} não é dono da rota ${targetRoute.userId}`); */
              // return res.status(403).json({ message: "Acesso negado a esta rota" });
            }
          }
          route = targetRoute;
        } else {
          /* console.log(`❌ [PROVIDER] Rota ID ${routeId} não encontrada no banco.`); */
        }
      } else {
        // Comportamento padrão: busca rota ativa do usuário
        let targetUserId = req.user.userId;
        // Se for admin e passar userId, permite ver rota de outro usuário (mantendo compatibilidade com o plano anterior)
        const userRole = (req.user.companyRole || req.user.role || '').toLowerCase();
        if (req.query.userId && userRole === 'admin') {
          targetUserId = parseInt(req.query.userId as string);
        }
        route = await storage.getProviderActiveRoute(targetUserId, dateParam, companyId);
      }

      if (!route) {
        /* console.log(`🚚 [PROVIDER] Nenhuma rota encontrada`); */
        return res.json(null); // Retorna null se não tiver rota, front trata
      }

      /* console.log(`🚚 [PROVIDER] Rota encontrada: ${route.id} - ${route.title}`); */

      // Buscar paradas (agendamentos) da rota
      // Precisamos buscar os routeStops e depois os appointments completos
      // Como não temos um método direto "getRouteStopsWithAppointments", vamos fazer em duas etapas ou adicionar no storage
      // Por simplicidade, vamos buscar os routeStops e depois os appointments

      // Nota: Idealmente isso estaria no storage, mas vamos compor aqui para não alterar demais o storage agora
      const allRouteStops = await db
        .select()
        .from(routeStops)
        .where(eq(routeStops.routeId, route.id))
        .orderBy(routeStops.order);

      const appointmentIds = allRouteStops.map(rs => rs.appointmentId);

      // Buscar detalhes dos agendamentos
      // Drizzle `inArray` precisa de array não vazio
      let appointmentsList: any[] = [];
      if (appointmentIds.length > 0) {
        // Precisamos fazer cast para array de strings uuid se for o caso, ou number
        // O schema diz que appointmentId em routeStops é uuid, mas appointments.id é serial (number)
        // O campo appointmentNumericId em routeStops parece ser o link correto para appointments.id (number)

        const numericIds = allRouteStops
          .map(rs => rs.appointmentNumericId)
          .filter((id): id is number => id !== null);

        if (numericIds.length > 0) {
          appointmentsList = await db
            .select()
            .from(appointments)
            .where(inArray(appointments.id, numericIds));
        }
      }

      let startAddressStr: string | null = null;
      try {
        const { businessRules } = await import("shared/schema");
        const [config] = await db.select().from(businessRules).where(eq(businessRules.companyId, companyId));
        if (config && config.enderecoEmpresaLogradouro) {
          startAddressStr = `${config.enderecoEmpresaLogradouro}, ${config.enderecoEmpresaNumero}, ${config.enderecoEmpresaBairro}, ${config.enderecoEmpresaCidade} - ${config.enderecoEmpresaEstado}, ${config.enderecoEmpresaCep}`;
        }
  
        if (route.responsibleType === 'technician') {
          const tech = await storage.getTechnician(Number(route.responsibleId), companyId);
          if (tech && tech.enderecoInicioLogradouro) {
               startAddressStr = `${tech.enderecoInicioLogradouro}, ${tech.enderecoInicioNumero}, ${tech.enderecoInicioBairro}, ${tech.enderecoInicioCidade} - ${tech.enderecoInicioEstado}, ${tech.enderecoInicioCep}`;
          }
        } else if (route.responsibleType === 'team') {
          const team = await storage.getTeam(Number(route.responsibleId), companyId);
          if (team && team.enderecoInicioLogradouro) {
               startAddressStr = `${team.enderecoInicioLogradouro}, ${team.enderecoInicioNumero}, ${team.enderecoInicioBairro}, ${team.enderecoInicioCidade} - ${team.enderecoInicioEstado}, ${team.enderecoInicioCep}`;
          }
        }
      } catch (err) {
        console.warn("Aviso: Falha ao buscar endereço de início", err);
      }

      // Combinar dados: RouteStop + Appointment + Client + Service
      const stopsWithDetails = await Promise.all(allRouteStops.map(async (stop) => {
        const apt = appointmentsList.find(a => a.id === stop.appointmentNumericId);
        if (!apt) return { ...stop, appointment: null };

        const client = await storage.getClient(apt.clientId, req.user.companyId);
        const service = await storage.getService(apt.serviceId, req.user.companyId);

        return {
          ...stop,
          appointment: {
            ...apt,
            clientName: client?.name || "Cliente não encontrado",
            phone1: client?.phone1 || null,
            phone2: client?.phone2 || null,
            address: client ? `${client.logradouro}, ${client.numero}${client.complemento ? ` - ${client.complemento}` : ''}` : null,
            serviceName: service?.name || "Serviço não encontrado",
            serviceDuration: service?.duration || 0,
            servicePrice: service?.price ? Number(service.price) : 0, // 💵 Preço do serviço
          }
        };
      }));

      res.json({
        route,
        startAddress: startAddressStr,
        stops: stopsWithDetails,
        summary: {
          totalStops: route.stopsCount,
          completedStops: appointmentsList.filter(a => a.status === 'completed').length,
          pendingStops: appointmentsList.filter(a => a.status === 'scheduled' || a.status === 'in_progress').length
        }
      });

    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao buscar rota:", error);
      res.status(500).json({ message: error.message });
    }

  });

  // 1.1 Listar prestadores com rotas ativas hoje (apenas admin)
  app.get("/api/provider/active-today", authenticateCompany, async (req: any, res) => {
    console.log(`🔍 [ACTIVE-TODAY] Requisição recebida`);
    console.log(`📋 [ACTIVE-TODAY] User:`, {
      userId: req.user?.userId,
      email: req.user?.email,
      companyRole: req.user?.companyRole,
      role: req.user?.role,
      companyId: req.user?.companyId
    });

    const userRole = (req.user?.companyRole || req.user?.role || '').toLowerCase();
    console.log(`🔐 [ACTIVE-TODAY] Role normalizada: "${userRole}" (companyRole: "${req.user?.companyRole}", role: "${req.user?.role}")`);
    
    if (userRole !== 'admin') {
      console.error(`❌ [ACTIVE-TODAY] Acesso negado. Role "${userRole}" !== "admin"`);
      return res.status(403).json({ message: "Acesso negado", currentRole: req.user?.companyRole || req.user?.role, requiredRole: "admin" });
    }
    
    console.log(`✅ [ACTIVE-TODAY] Permissão concedida`);

    try {
      // 🌎 Usar horário de São Paulo (UTC-3) para comparação de data
      const dateParam = req.query.date ? new Date(req.query.date) : nowInSaoPaulo();
      const dateStrSP = formatDateForSQLComparison(dateParam);
      /* console.log(`🔍 [PROVIDER] Buscando rotas ativas para data: ${dateStrSP} (São Paulo) - UTC: ${dateParam.toISOString()}`); */

      // Buscar todas as rotas do dia que estão confirmadas ou finalizadas (não mostra rascunhos)
      const activeRoutesWithId = await db
        .select({
          id: routes.id,
          userId: routes.userId,
          responsibleId: routes.responsibleId,
          responsibleType: routes.responsibleType,
          title: routes.title,
          status: routes.status
        })
        .from(routes)
        .where(and(
          sql`DATE(${routes.date} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = ${dateStrSP}`,
          or(
            eq(routes.status, 'confirmado'),
            eq(routes.status, 'finalizado')
          )
        ));

      /* console.log(`🔍 [PROVIDER] Rotas encontradas: ${activeRoutesWithId.length}`); */

      const result = await Promise.all(activeRoutesWithId.map(async (r) => {
        let name = "Desconhecido";
        if (r.responsibleType === 'technician') {
          const tech = await storage.getTechnician(Number(r.responsibleId), req.user.companyId);
          if (tech) name = tech.name;
        } else if (r.responsibleType === 'team') {
          const team = await storage.getTeam(Number(r.responsibleId), req.user.companyId);
          if (team) name = team.name;
        }

        return {
          id: r.id,
          title: r.title,
          responsibleName: name,
          status: r.status
        };
      }));

      res.json(result);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao listar prestadores ativos:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app.put("/api/provider/appointments/:id", authenticateCompany, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, feedback, photos, signature, executionStatus, executionNotes, executionStartedAt, executionFinishedAt, executionStartLocation, executionEndLocation, paymentStatus, paymentAmountPaid, paymentNotes, paymentConfirmedAt } = req.body;

      // 🔒 Validar se a rota pai já está finalizada (apenas finalizado/cancelado bloqueiam)
      const appointmentStops = await db.select().from(routeStops).where(eq(routeStops.appointmentNumericId, id));

      // Verificar se existe pelo menos uma rota ativa (não finalizada) para este agendamento
      // Isso permite editar agendamentos que foram reutilizados em novas rotas
      let hasActiveRoute = false;
      for (const stop of appointmentStops) {
        const [r] = await db.select().from(routes).where(eq(routes.id, stop.routeId));
        console.log(`[DEBUG] Rota ${stop.routeId} status: ${r?.status}`);
        if (r && !['finalizado', 'cancelado'].includes(r.status)) {
          hasActiveRoute = true;
          break; // Encontrou uma rota ativa, pode editar
        }
      }

      // Só bloqueia se NÃO houver nenhuma rota ativa E houver rotas finalizadas
      if (!hasActiveRoute && appointmentStops.length > 0) {
        return res.status(400).json({ message: "Não é possível editar um agendamento de uma rota já finalizada." });
      }

      const updated = await storage.updateAppointmentExecution(id, {
        status,
        feedback,
        photos,
        signature,
        executionStatus,
        executionNotes,
        executionStartedAt, // 🆕 Adicionado para persistir o horário de início
        executionFinishedAt,
        executionStartLocation,
        executionEndLocation,
        paymentStatus,       // 💵 Status de pagamento
        paymentAmountPaid,   // 💵 Valor pago (parcial)
        paymentNotes,        // 💵 Motivo se não pagou
        paymentConfirmedAt   // 💵 Quando foi confirmado
      }, req.user.userId);

      res.json(updated);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao atualizar agendamento:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 2.5 Iniciar rota (registrar routeStartedAt)
  app.patch("/api/routes/:id/start", authenticateCompany, async (req: any, res) => {
    try {
      const startTime = Date.now();
      const { id } = req.params; // UUID
      const { startLocationData, vehicleId } = req.body; // { lat, lng, address, timestamp }, vehicleId (opcional)

      console.log(`⏱️ [START-ROUTE] Iniciando processo para rota ${id}`);
      
      // Verificar se rota existe
      let stepStart = Date.now();
      const existingRoute = await db.query.routes.findFirst({
        where: eq(routes.id, id)
      });
      console.log(`⏱️ [START-ROUTE] Etapa 1 (buscar rota): ${Date.now() - stepStart}ms`);

      if (!existingRoute) {
        return res.status(404).json({ message: "Rota não encontrada" });
      }

      // Verificar se já foi iniciada
      if (existingRoute.routeStartedAt) {
        return res.status(400).json({ message: "Rota já foi iniciada" });
      }

      // 🚗 Validar veículo se fornecido
      if (vehicleId) {
        stepStart = Date.now();
        const vehicleIdNum = parseInt(vehicleId);
        if (!isNaN(vehicleIdNum)) {
          // Verificar se o veículo existe e pertence à empresa
          const vehicle = await storage.getVehicle(vehicleIdNum, req.user.companyId);
          if (!vehicle) {
            return res.status(404).json({ message: "Veículo não encontrado" });
          }
          console.log(`⏱️ [START-ROUTE] Etapa 2 (validar veículo): ${Date.now() - stepStart}ms`);
          /* console.log(`🚗 [PROVIDER] Rota ${id} será iniciada com veículo: ${vehicle.plate}`); */
        }
      }

      // ⏱️ Registrar timestamp de início + veículo usado
      stepStart = Date.now();
      const [route] = await db.update(routes)
        .set({
          routeStartedAt: nowInSaoPaulo(),
          startLocationData: startLocationData || null,
          vehicleId: vehicleId ? parseInt(vehicleId) : null,
          updatedAt: nowInSaoPaulo()
        })
        .where(eq(routes.id, id))
        .returning();
      console.log(`⏱️ [START-ROUTE] Etapa 3 (atualizar rota): ${Date.now() - stepStart}ms`);

      // 🔄 Atualizar status dos agendamentos para 'in_progress'
      // Buscar todos os appointments desta rota que estão com status 'scheduled' ou 'rescheduled'
      stepStart = Date.now();
      const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, id));
      console.log(`⏱️ [START-ROUTE] Etapa 4 (buscar paradas): ${Date.now() - stepStart}ms`);
      console.log(`🔍 [START-ROUTE] Rota ${id} tem ${stops.length} paradas.`);

      const appointmentIds = stops
        .map(s => s.appointmentNumericId)
        .filter((id): id is number => id !== null);

      console.log(`🔍 [START-ROUTE] IDs de agendamentos encontrados (validados):`, appointmentIds);

      if (appointmentIds.length > 0) {
        // Log para ver status atuais antes de tentar update
        stepStart = Date.now();
        const currentStatuses = await db
          .select({ id: appointments.id, status: appointments.status })
          .from(appointments)
          .where(inArray(appointments.id, appointmentIds));
        console.log(`⏱️ [START-ROUTE] Etapa 5 (buscar status agendamentos): ${Date.now() - stepStart}ms`);
        console.log(`🔍 [START-ROUTE] Status atuais dos agendamentos:`, currentStatuses);

        stepStart = Date.now();
        const result = await db.update(appointments)
          .set({
            status: 'in_progress',
            // Opcional: registrar que "aguarda execução" no executionStatus se quiser, 
            // mas o padrão é deixar null até o prestador mexer.
          })
          .where(and(
            inArray(appointments.id, appointmentIds),
            or(
              eq(appointments.status, 'scheduled'),
              eq(appointments.status, 'rescheduled')
            )
          ))
          .returning();
        console.log(`⏱️ [START-ROUTE] Etapa 6 (atualizar status agendamentos): ${Date.now() - stepStart}ms`);

        console.log(`🔄 [ROTA] ${result.length} agendamentos foram EFETIVAMENTE atualizados para 'in_progress' na rota ${id}`);
        console.log(`   IDs atualizados:`, result.map(a => a.id));
      } else {
        console.log(`⚠️ [START-ROUTE] Nenhum ID numérico de agendamento encontrado nas paradas da rota.`);
      }

      const totalTime = Date.now() - startTime;
      /* console.log(`✅ [PROVIDER] Rota ${id} iniciada às ${route.routeStartedAt}`); */
      console.log(`⏱️ [START-ROUTE] TEMPO TOTAL: ${totalTime}ms`);
      res.json(route);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao iniciar rota:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3. Finalizar rota
  app.post("/api/provider/route/:id/finalize", authenticateCompany, async (req: any, res) => {
    try {
      const { id } = req.params; // UUID
      const { status, motivo, routeEndLocation, endLocationData } = req.body; // endLocationData: { lat, lng, address, timestamp }

      // Validar status permitido
      if (!['finalizado', 'incompleto', 'cancelado'].includes(status)) {
        return res.status(400).json({ message: "Status inválido para finalização" });
      }

      // 🔒 VALIDAÇÃO: Todos os agendamentos devem ter execution_status preenchido
      // (Exceto se a rota estiver sendo CANCELADA inteira? O usuário pediu para não deixar finalizar rota se algum ficar sem status.
      // Vou assumir que para "finalizado" e "incompleto" precisa verificar. Para "cancelado" talvez não, mas por segurança vou exigir em todos,
      // pois "cancelado" na rota também implica um estado final.)

      const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, id));
      const appointmentIds = stops
        .map(s => s.appointmentNumericId)
        .filter((id): id is number => id !== null);

      if (appointmentIds.length > 0) {
        const apts = await db.select().from(appointments).where(inArray(appointments.id, appointmentIds));
        // Verifica se algum NÃO tem executionStatus
        const missingStatus = apts.filter(a => !a.executionStatus || a.executionStatus.trim() === '');

        if (missingStatus.length > 0) {
          return res.status(400).json({
            message: "Existem atendimentos pendentes de registro. Informe o status de execução de todos antes de encerrar a rota.",
            missingCount: missingStatus.length
          });
        }
      }

      // ⏱️ Salvar timestamp de finalização e local
      const updateData: any = {
        status,
        routeFinishedAt: nowInSaoPaulo(),
        updatedAt: nowInSaoPaulo()
      };

      if (routeEndLocation && ['last_client', 'company_home'].includes(routeEndLocation)) {
        updateData.routeEndLocation = routeEndLocation;
      }

      if (endLocationData) {
        updateData.endLocationData = endLocationData;
      }

      const [route] = await db.update(routes)
        .set(updateData)
        .where(eq(routes.id, id))
        .returning();

      if (motivo) {
        // Se quiser salvar motivo na rota, precisaria de coluna "notes" na tabela routes
      }

      res.json(route);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao finalizar rota:", error);
      res.status(500).json({ message: error.message });
    }
  });


  // 3.5 Registrar ocorrência na rota (pausas como almoço, abastecimento, etc.)
  app.post("/api/provider/route/:id/occurrence", authenticateCompany, async (req: any, res) => {
    try {
      const { id } = req.params; // UUID da rota
      const { type, notes, approximateTime, durationMinutes } = req.body;

      // Validar tipo
      const validTypes = ['almoco', 'problema_tecnico', 'abastecimento', 'outro'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ message: "Tipo de ocorrência inválido" });
      }

      // Validar campos de tempo (opcional)
      if (approximateTime && !/^\d{2}:\d{2}$/.test(approximateTime)) {
        return res.status(400).json({ message: "Formato de hora inválido. Use HH:mm" });
      }

      // Inserir ocorrência
      const [occurrence] = await db.insert(routeOccurrences).values({
        routeId: id,
        userId: req.user.userId,
        type,
        startedAt: nowInSaoPaulo(),
        notes: notes || null,
        approximateTime: approximateTime || null,
        durationMinutes: durationMinutes || null
      }).returning();

      res.json(occurrence);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao registrar ocorrência:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3.6 Listar ocorrências da rota
  app.get("/api/provider/route/:id/occurrences", authenticateCompany, async (req: any, res) => {
    try {
      const { id } = req.params;

      const occurrences = await db.select()
        .from(routeOccurrences)
        .where(eq(routeOccurrences.routeId, id))
        .orderBy(desc(routeOccurrences.startedAt));

      res.json(occurrences);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao listar ocorrências:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🛰️ GEOLOCALIZAÇÃO: Receber Tracking Points
  app.post("/api/tracking/location", authenticateCompany, async (req: any, res) => {
    try {
      const companyId = requireCompanyId(req, res);
      if (!companyId) return;

      const { points } = req.body; // Aceita um array de pontos ou um único ponto

      if (!points) {
        return res.status(400).json({ message: "Dados de localização inválidos" });
      }

      const locations = Array.isArray(points) ? points : [points];

      // Mapear para insert
      const insertData = locations.map((loc: any) => ({
        userId: req.user.userId,
        companyId,
        routeId: loc.routeId || null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: new Date(loc.timestamp),
        accuracy: loc.accuracy || null,
        batteryLevel: loc.batteryLevel || null,
        speed: loc.speed || null,
        heading: loc.heading || null,
        providerId: req.user.entityId || null // Opcional
      }));

      await db.insert(trackingLocations).values(insertData);

      console.log(`📍 [TRACKING] ${insertData.length} pontos salvos para user ${req.user.userId}`);
      res.json({ success: true, count: insertData.length });
    } catch (error: any) {
      console.error("❌ [TRACKING] Erro ao salvar localização:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🛰️ GEOLOCALIZAÇÃO: Buscar rota percorrida
  app.get("/api/tracking/route/:routeId", authenticateCompany, async (req: any, res) => {
    try {
      const companyId = requireCompanyId(req, res);
      if (!companyId) return;

      const { routeId } = req.params;

      const points = await db.select()
        .from(trackingLocations)
        .where(and(eq(trackingLocations.companyId, companyId), eq(trackingLocations.routeId, routeId)))
        .orderBy(asc(trackingLocations.timestamp));

      res.json(points);
    } catch (error: any) {
      console.error("❌ [TRACKING] Erro ao buscar rota:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 3.7 Finalizar ocorrência (marcar hora de fim)
  app.patch("/api/provider/occurrence/:id/finish", authenticateCompany, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      const [occurrence] = await db.update(routeOccurrences)
        .set({ finishedAt: nowInSaoPaulo() })
        .where(eq(routeOccurrences.id, id))
        .returning();

      if (!occurrence) {
        return res.status(404).json({ message: "Ocorrência não encontrada" });
      }

      res.json(occurrence);
    } catch (error: any) {
      console.error("❌ [PROVIDER] Erro ao finalizar ocorrência:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 4. Listar pendências (agendamentos não concluídos de rotas finalizadas)
  app.get("/api/pending-appointments", authenticateCompany, async (req: any, res) => {
    try {
      const pendencias = await storage.getPendingAppointments(req.user.companyId);
      logEgressSize(req, pendencias); // 📊 Instrumentação
      res.json(pendencias);
    } catch (error: any) {
      console.error("❌ [PENDING] Erro ao listar pendências:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== FUEL RECORDS (ABASTECIMENTO) ====================

  // Listar registros de abastecimento (com filtros opcionais)
  app.get("/api/fuel-records", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const { vehicleId, startDate, endDate } = req.query;

      const filters: { vehicleId?: number; startDate?: Date; endDate?: Date } = {};

      if (vehicleId) {
        filters.vehicleId = parseInt(vehicleId as string);
      }
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const records = await storage.getFuelRecords(req.user.companyId, filters);
      logEgressSize(req, records); // 📊 Instrumentação
      res.json(records);
    } catch (error: any) {
      console.error("❌ [FUEL] Erro ao listar registros:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Criar registro de abastecimento (prestador/tecnico podem registrar via ocorrência de rota)
  app.post("/api/fuel-records", authenticateCompany, requireRole(['admin', 'operador', 'prestador', 'tecnico']), async (req: any, res) => {
    try {
      const { vehicleId, fuelType, liters, pricePerLiter, totalCost, odometerKm, notes, fuelDate, occurrenceId } = req.body;

      if (!vehicleId || !fuelType || !liters || !pricePerLiter || !totalCost) {
        return res.status(400).json({ message: "Campos obrigatórios: vehicleId, fuelType, liters, pricePerLiter, totalCost" });
      }

      const record = await storage.createFuelRecord({
        vehicleId,
        fuelType,
        liters,
        pricePerLiter,
        totalCost,
        odometerKm: odometerKm || null,
        notes: notes || null,
        fuelDate: fuelDate ? new Date(fuelDate) : nowInSaoPaulo(),
        occurrenceId: occurrenceId || null,
      }, req.user.userId, req.user.companyId);

      console.log(`⛽ [FUEL] Registro criado: veículo ${vehicleId}, ${liters}L de ${fuelType} por R$${totalCost}`);
      res.json(record);
    } catch (error: any) {
      console.error("❌ [FUEL] Erro ao criar registro:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Estatísticas de consumo por veículo
  app.get("/api/fuel-records/vehicle/:id/stats", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const vehicleId = parseInt(req.params.id);
      const stats = await storage.getVehicleFuelStats(vehicleId, req.user.companyId);
      res.json(stats);
    } catch (error: any) {
      console.error("❌ [FUEL] Erro ao buscar estatísticas:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard: Fleet fuel statistics (with optional filters)
  app.get("/api/dashboard/fuel-stats", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const { vehicleIds, fuelTypes, startDate, endDate } = req.query;

      const filters: { vehicleIds?: number[]; fuelTypes?: string[]; startDate?: Date; endDate?: Date } = {};

      if (vehicleIds) {
        filters.vehicleIds = String(vehicleIds).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      if (fuelTypes) {
        filters.fuelTypes = String(fuelTypes).split(',').map(t => t.trim()).filter(t => t.length > 0);
      }
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string + "T23:59:59");
      }

      const stats = await storage.getFleetFuelStats(req.user.companyId, filters);
      res.json(stats);
    } catch (error: any) {
      console.error("❌ [DASHBOARD] Erro ao buscar estatísticas de combustível:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint para gerar matriz do OSRM
  app.post('/api/rota/matrix', async (req, res) => {
    /* console.log("==== LOG INÍCIO: /api/rota/matrix ===="); */
    /* console.log("Dados recebidos no req.body:"); */
    /* console.log(JSON.stringify(req.body, null, 2)); */

    const { coords } = req.body; // Ex: [[lon, lat], [lon, lat], ...]
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
      /* console.log("❌ ERRO: Coordenadas inválidas"); */
      /* console.log("Coordenadas recebidas:", coords); */
      /* console.log("==== LOG FIM: /api/rota/matrix (ERRO) ===="); */
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }

    const coordStr = coords.map((c: number[]) => {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        throw new Error(`Coordenada inválida na matrix: lng=${c[0]}, lat=${c[1]}`);
      }
      return `${lng.toFixed(6)},${lat.toFixed(6)}`; 
    }).join(';');
    const OSRM_URL = getOsrmUrl()?.replace(/\/$/, '') || null;
    console.log("🌐 OSRM_URL configurado:", OSRM_URL);

    if (!OSRM_URL) {
      /* console.log("❌ ERRO: OSRM_URL não configurado"); */
      /* console.log("==== LOG FIM: /api/rota/matrix (ERRO CONFIG) ===="); */
      return res.status(500).json({ error: "Endereço OSRM não configurado. Crie/atualize o arquivo osrm_url.txt." });
    }

    const osrmUrl = `${OSRM_URL}/table/v1/driving/${coordStr}?annotations=duration,distance`;
    console.log("🌐 URL completa para OSRM:");
    console.log(osrmUrl);

    try {
      console.log("🚀 Fazendo chamada para OSRM...");
      const resp = await fetch(osrmUrl);
      const data = await resp.json();

      console.log("📦 Resposta completa do OSRM:");
      console.log(JSON.stringify(data, null, 2));

      if (!data.durations || !data.distances) {
        /* console.log("❌ ERRO: OSRM não retornou durations ou distances"); */
        /* console.log("==== LOG FIM: /api/rota/matrix (ERRO OSRM) ===="); */
        return res.status(500).json({ error: 'OSRM não respondeu corretamente - durations ou distances não encontradas' });
      }

      /* console.log("✅ Matriz de tempos extraída:"); */
      /* console.log(JSON.stringify(data.durations, null, 2)); */
      /* console.log("✅ Matriz de distâncias extraída:"); */
      /* console.log(JSON.stringify(data.distances, null, 2)); */
      /* console.log("==== LOG FIM: /api/rota/matrix (SUCESSO) ===="); */

      return res.json({
        matrix: data.durations,
        durations: data.durations,
        distances: data.distances
      });
    } catch (e: any) {
      console.log("❌ ERRO na chamada OSRM:");
      console.log("Mensagem de erro:", e.message);
      console.log("Stack trace completo:");
      console.log(e.stack);
      console.log("==== LOG FIM: /api/rota/matrix (EXCEÇÃO) ====");
      return res.status(500).json({ error: 'Erro consultando OSRM', details: e.message });
    }
  });

  // Endpoint para resolver TSP via Python
  app.post('/api/rota/tsp', async (req, res) => {
    /* console.log("==== LOG INÍCIO: /api/rota/tsp ===="); */
    /* console.log("Dados recebidos no req.body:"); */
    /* console.log(JSON.stringify(req.body, null, 2)); */

    const { matrix, terminarNoPontoInicial } = req.body;
    if (!matrix || !Array.isArray(matrix)) {
      /* console.log("❌ ERRO: Matriz inválida"); */
      /* console.log("Matriz recebida:", matrix); */
      /* console.log("==== LOG FIM: /api/rota/tsp (ERRO) ===="); */
      return res.status(400).json({ error: 'Matriz inválida' });
    }

    console.log("📊 Matriz para TSP:");
    console.log(`Dimensões: ${matrix.length}x${matrix[0]?.length || 0}`);
    console.log("Primeira linha da matriz:");
    console.log(JSON.stringify(matrix[0], null, 2));

    const { spawn } = await import('child_process');

    // Resolve paths usando process.cwd() como raiz do projeto
    const projectRoot = process.cwd();
    console.log("📁 Raiz do projeto:", projectRoot);

    // Permite configurar via .env (opcional) ou usa o padrão do venv
    const pyFromEnv = process.env.PYTHON_BIN?.trim();
    const pyBin = pyFromEnv || path.join(projectRoot, "server", "py", ".venv", "Scripts", "python.exe");
    const tspScript = path.join(projectRoot, "server", "solve_tsp.py");

    console.log("🐍 Caminhos resolvidos:");
    console.log("  Python binary:", pyBin);
    console.log("  TSP script:", tspScript);

    // Verifica se o executável Python existe
    if (!fs.existsSync(pyBin)) {
      /* console.log("❌ ERRO: Executável Python não encontrado:", pyBin); */
      /* console.log("==== LOG FIM: /api/rota/tsp (ERRO) ===="); */
      return res.status(500).json({
        error: 'Executável Python não encontrado',
        path: pyBin,
        suggestion: 'Verifique se o ambiente virtual está configurado ou defina PYTHON_BIN no .env'
      });
    }

    // Verifica se o script TSP existe
    if (!fs.existsSync(tspScript)) {
      /* console.log("❌ ERRO: Script TSP não encontrado:", tspScript); */
      /* console.log("==== LOG FIM: /api/rota/tsp (ERRO) ===="); */
      return res.status(500).json({
        error: 'Script TSP não encontrado',
        path: tspScript
      });
    }

    console.log("✅ Arquivos verificados, iniciando processo Python...");

    let py: any;
    let killTimer: NodeJS.Timeout;
    let output = '';
    let errors = '';
    let processKilled = false;

    try {
      py = spawn(pyBin, [tspScript], { stdio: ["pipe", "pipe", "pipe"] });
    } catch (spawnError: any) {
      /* console.log("❌ ERRO ao iniciar processo Python:", spawnError.message); */
      /* console.log("==== LOG FIM: /api/rota/tsp (ERRO SPAWN) ===="); */
      return res.status(500).json({
        error: 'Falha ao iniciar processo Python',
        details: spawnError.message,
        pythonPath: pyBin
      });
    }

    // Timeout de 15 segundos para matar o processo se necessário
    killTimer = setTimeout(() => {
      if (py && !py.killed) {
        console.log("⏰ TIMEOUT: Matando processo Python após 15s");
        processKilled = true;
        try {
          py.kill('SIGKILL');
        } catch (killError) {
          console.log("❌ Erro ao matar processo:", killError);
        }
      }
    }, 15000);

    py.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      console.log("📝 Python stdout:", chunk);
      output += chunk;
    });

    py.stderr.on('data', (data: Buffer) => {
      const errorChunk = data.toString();
      console.log("❌ Python stderr:", errorChunk);
      errors += errorChunk;
    });

    py.on('error', (spawnError: any) => {
      clearTimeout(killTimer);
      /* console.log("❌ ERRO no processo Python:", spawnError.message); */
      /* console.log("==== LOG FIM: /api/rota/tsp (ERRO PROCESSO) ===="); */
      if (!res.headersSent) {
        return res.status(500).json({
          error: 'Erro no processo Python',
          details: spawnError.message
        });
      }
    });

    py.on('close', (code: number) => {
      clearTimeout(killTimer);
      console.log(`🔚 Processo Python finalizado com código: ${code}`);
      console.log("📤 Output completo do Python:", output);
      if (errors) {
        console.log("⚠️ Erros do Python (stderr):", errors);
      }

      // Se o processo foi morto por timeout
      if (processKilled) {
        /* console.log("==== LOG FIM: /api/rota/tsp (TIMEOUT) ===="); */
        if (!res.headersSent) {
          return res.status(500).json({
            error: 'Timeout: Processo Python excedeu 15 segundos',
            stderr: (errors || "").trim(),
            stdout: (output || "").trim()
          });
        }
        return;
      }

      // Se Python saiu com erro, devolva JSON contendo stderr e stdout
      if (code !== 0) {
        /* console.log("==== LOG FIM: /api/rota/tsp (ERRO PYTHON) ===="); */
        if (!res.headersSent) {
          return res.status(500).json({
            error: 'Erro no Python',
            exitCode: code,
            stderr: (errors || "").trim(),
            stdout: (output || "").trim(),
          });
        }
        return;
      }

      // Protege contra stdout vazio/JSON inválido
      try {
        const result = output ? JSON.parse(output) : null;
        if (!result) {
          /* console.log("❌ STDOUT vazio - JSON ausente"); */
          /* console.log("==== LOG FIM: /api/rota/tsp (ERRO PARSE) ===="); */
          if (!res.headersSent) {
            return res.status(500).json({
              error: 'Erro no Python',
              parseError: 'stdout vazio',
              stderr: (errors || "").trim(),
              stdout: (output || "").trim(),
            });
          }
          return;
        }
        /* console.log("✅ Resultado TSP parseado:"); */
        /* console.log(JSON.stringify(result, null, 2)); */
        /* console.log("==== LOG FIM: /api/rota/tsp (SUCESSO) ===="); */
        if (!res.headersSent) {
          return res.json(result);
        }
      } catch (e: any) {
        /* console.log("❌ ERRO ao parsear JSON do Python:", e.message); */
        /* console.log("Output original:", output); */
        /* console.log("==== LOG FIM: /api/rota/tsp (ERRO PARSE) ===="); */
        if (!res.headersSent) {
          return res.status(500).json({
            error: 'Erro no Python',
            parseError: e.message,
            stderr: (errors || "").trim(),
            stdout: (output || "").trim(),
          });
        }
      }
    });

    // Prepara dados de entrada exatamente como esperado pelo Python
    const inputData = { matrix, terminarNoPontoInicial: Boolean(terminarNoPontoInicial) };

    console.log("📤 Enviando dados para Python:");
    console.log(JSON.stringify(inputData, null, 2));

    try {
      py.stdin.write(JSON.stringify(inputData));
      py.stdin.end();
      console.log("✅ Dados enviados para Python, aguardando resposta...");
    } catch (writeError: any) {
      clearTimeout(killTimer);
      console.log("❌ ERRO ao enviar dados para Python:", writeError.message);
      console.log("==== LOG FIM: /api/rota/tsp (ERRO WRITE) ====");
      if (!res.headersSent) {
        return res.status(500).json({
          error: 'Erro ao enviar dados para Python',
          details: writeError.message
        });
      }
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({
          message: "Este email já está cadastrado. Faça login ou use outro email."
        });
      }

      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id, email: user.email, sysVer: getSystemVersion() }, JWT_SECRET, { expiresIn: '24h' });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan
        },
        token
      });
    } catch (error: any) {
      // Database connection errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' ||
        error.message?.includes('database') || error.message?.includes('connection')) {
        console.error("❌ Erro de conexão com banco de dados no registro:", error);
        return res.status(503).json({
          message: "Não foi possível conectar ao banco de dados. Verifique se o Supabase está ativo e se a DATABASE_URL está correta."
        });
      }

      // Validation errors
      if (error.name === 'ZodError') {
        console.error("❌ Erro de validação no registro:", error);
        return res.status(400).json({
          message: "Dados inválidos. Verifique todos os campos obrigatórios (nome, email, username, senha)."
        });
      }

      // Unique constraint violations (duplicate username, etc)
      if (error.code === '23505' || error.message?.includes('unique')) {
        console.error("❌ Erro de duplicação no registro:", error);
        return res.status(400).json({
          message: "Nome de usuário ou email já está em uso. Tente outro."
        });
      }

      // Generic error
      console.error("❌ Erro no registro:", error);
      res.status(500).json({
        message: error.message || "Erro ao criar conta. Tente novamente."
      });
    }
  });

  // 🛡️ Login com rate limiting (máximo 5 tentativas por 15 min)
  app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.validateUser(email, password);
      if (!user) {
        return res.status(401).json({
          message: "Email ou senha incorretos. Verifique suas credenciais e tente novamente."
        });
      }

      // 🔐 LGPD: Verificar se usuário está ativo
      if (!user.isActive) {
        return res.status(403).json({
          message: "Sua conta está inativa. Entre em contato com o administrador."
        });
      }

      // 🔐 LGPD: Verificar se email foi verificado
      if (!user.emailVerified) {
        return res.status(403).json({
          message: "Seu email ainda não foi verificado. Verifique sua caixa de entrada e clique no link de verificação."
        });
      }

      // 🕒 VALIDAÇÃO DE HORÁRIO DE ACESSO NO LOGIN
      // Verificar se usuário tem restrição de horário ANTES de criar o token
      if (user.accessScheduleId) {
        console.log(`🕒 [LOGIN] Verificando horário para usuário ${user.email}, tabela ID: ${user.accessScheduleId}`);
        try {
          const schedule = await storage.getAccessScheduleById(user.accessScheduleId);

          if (schedule) {
            console.log(`🕒 [LOGIN] Tabela encontrada: ${schedule.name}`);
            const allowed = isAccessAllowed(schedule);

            if (!allowed) {
              console.log(`❌ [LOGIN] ACESSO NEGADO - Usuário fora do horário permitido`);
              return res.status(403).json({
                message: getAccessDeniedMessage(schedule),
                reason: 'access_schedule_restriction'
              });
            }

            console.log(`✅ [LOGIN] Horário de acesso válido - login permitido`);
          }
        } catch (error) {
          console.error('❌ [LOGIN] Erro ao validar horário:', error);
          // Em caso de erro, permitir login para não bloquear sistema
        }
      }

      // Atualizar último login
      await storage.updateLastLogin(user.id);

      // Buscar memberships do usuário (multiempresa)
      const memberships = await storage.getMembershipsByUserId(user.id);
      
      console.log(`🔍 [LOGIN] Usuário ${user.email} (ID: ${user.id})`);
      console.log(`   - Memberships ativas: ${memberships.length}`);
      memberships.forEach(m => {
        console.log(`     • Empresa ${m.companyId} - Role: ${m.role} - Ativo: ${m.isActive}`);
      });

      // 🏢 MULTI-TENANT: Se usuário tem 2+ empresas, exigir seleção
      if (memberships.length > 1) {
        // Buscar dados de todas as empresas para exibição no frontend
        const companiesList = await Promise.all(
          memberships.map(async (m) => {
            const comp = await storage.getCompanyById(m.companyId);
            return {
              companyId: m.companyId,
              companyRole: m.role,
              companyName: comp?.name || 'Empresa desconhecida',
              companyCnpj: comp?.cnpj || '',
            };
          })
        );

        console.log(`🏢 [LOGIN] Usuário ${user.email} tem ${memberships.length} empresas. Exigindo seleção.`);

        return res.json({
          requireCompanySelection: true,
          userId: user.id,
          userName: user.name,
          companies: companiesList,
          // Token temporário para a etapa de seleção (curta duração, sem companyId)
          selectionToken: jwt.sign({
            userId: user.id,
            email: user.email,
            purpose: 'company_selection',
            sysVer: getSystemVersion()
          }, JWT_SECRET, { expiresIn: '5m' }),
        });
      }

      // Se tem 0 ou 1 membership, login direto (comportamento original)
      let companyId: number | undefined;
      let companyRole: string | undefined;
      let company: any | undefined;

      if (memberships.length === 1) {
        const primaryMembership = memberships[0];
        companyId = primaryMembership.companyId;
        companyRole = primaryMembership.role;
        company = await storage.getCompanyById(companyId);
      }

      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role, // Role antigo (compatibilidade)
        companyId: companyId,
        companyRole: companyRole,
      }, JWT_SECRET, { expiresIn: '24h' });

      // 🔐 Registrar login no log de auditoria
      try {
        await storage.logAudit({
          userId: user.id,
          action: 'login',
          resource: 'auth',
          details: { email: user.email, companyId },
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent'],
        });
        // Nova auditoria por empresa
        trackCompanyAudit({
          userId: user.id,
          companyId: companyId || null,
          userName: user.name,
          feature: "auth",
          action: "login",
          description: "Fez login no sistema",
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
        });
      } catch (auditError) {
        console.error('⚠️ Erro ao registrar log de auditoria:', auditError);
        // Não bloquear login por falha no audit
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin || false,
          requirePasswordChange: user.requirePasswordChange,
          companyId: companyId,
          companyRole: companyRole,
          company: company ? {
            id: company.id,
            name: company.name,
          } : undefined,
          // 🔐 LGPD - Campos de aceite de termos
          lgpdAccepted: user.lgpdAccepted,
          lgpdAcceptedAt: user.lgpdAcceptedAt,
          lgpdVersion: user.lgpdVersion,
        },
        token
      });
    } catch (error: any) {
      // 🔍 Log detalhado do erro para debugging
      console.error("❌ [LOGIN] Erro capturado:", {
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 200)
      });

      // 🌐 Database connection/pooler errors (incluindo timeout do pooler)
      if (error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message?.toLowerCase().includes('pool') ||
        error.message?.toLowerCase().includes('pooler') ||
        error.message?.toLowerCase().includes('timeout') ||
        error.message?.toLowerCase().includes('database') ||
        error.message?.toLowerCase().includes('connection')) {

        console.error("❌ [LOGIN] Erro de conexão/pooler detectado:", {
          errorCode: error.code,
          errorMessage: error.message
        });

        return res.status(503).json({
          message: "Não foi possível conectar ao banco de dados no momento. Isso pode ocorrer em períodos de inatividade (cold start). Por favor, tente novamente.",
          retryable: true
        });
      }

      // ⚠️ Validation errors
      if (error.name === 'ZodError') {
        console.error("❌ [LOGIN] Erro de validação:", error);
        return res.status(400).json({
          message: "Dados inválidos. Verifique o email e a senha."
        });
      }

      // ❓ Generic error
      console.error("❌ [LOGIN] Erro genérico:", error);
      res.status(500).json({
        message: error.message || "Erro interno no servidor. Tente novamente."
      });
    }
  });

  // 🏢 MULTI-TENANT: Seleção de empresa após login (2ª etapa)
  app.post("/api/auth/select-company", async (req, res) => {
    try {
      const { selectionToken, companyId } = req.body;

      if (!selectionToken || !companyId) {
        return res.status(400).json({ message: "Token de seleção e companyId são obrigatórios." });
      }

      // Verificar token temporário de seleção
      let decoded: any;
      try {
        decoded = jwt.verify(selectionToken, JWT_SECRET);
      } catch (err) {
        return res.status(403).json({ message: "Token de seleção expirado ou inválido. Faça login novamente." });
      }

      if (decoded.purpose !== 'company_selection') {
        return res.status(403).json({ message: "Token inválido para esta operação." });
      }

      const userId = decoded.userId;
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      // Verificar se o usuário realmente tem membership nesta empresa
      const membership = await storage.getMembership(userId, companyId);
      if (!membership) {
        return res.status(403).json({ message: "Você não tem acesso a esta empresa." });
      }

      const company = await storage.getCompanyById(companyId);

      // Gerar token definitivo com companyId
      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: companyId,
        companyRole: membership.role,
        sysVer: getSystemVersion()
      }, JWT_SECRET, { expiresIn: '24h' });

      // 🔐 Registrar login no log de auditoria
      try {
        await storage.logAudit({
          userId: user.id,
          action: 'login',
          resource: 'auth',
          details: { email: user.email, companyId, companySelection: true },
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString(),
          userAgent: req.headers['user-agent'],
        });
        trackCompanyAudit({
          userId: user.id,
          companyId: companyId || null,
          userName: user.name,
          feature: "auth",
          action: "login",
          description: `Fez login selecionando empresa: ${company?.name || companyId}`,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
        });
      } catch (auditError) {
        console.error('⚠️ Erro ao registrar log de auditoria:', auditError);
      }

      console.log(`✅ [SELECT-COMPANY] Usuário ${user.email} selecionou empresa ${company?.name} (ID: ${companyId})`);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin || false,
          requirePasswordChange: user.requirePasswordChange,
          companyId: companyId,
          companyRole: membership.role,
          company: company ? { id: company.id, name: company.name } : undefined,
          lgpdAccepted: user.lgpdAccepted,
          lgpdAcceptedAt: user.lgpdAcceptedAt,
          lgpdVersion: user.lgpdVersion,
        },
        token,
      });
    } catch (error: any) {
      console.error("❌ [SELECT-COMPANY] Erro:", error);
      res.status(500).json({ message: error.message || "Erro ao selecionar empresa." });
    }
  });

  // 🏢 MULTI-TENANT: Trocar de empresa após já estar logado (Company Switcher)
  app.post("/api/auth/switch-company", authenticateToken, async (req: any, res) => {
    try {
      const { companyId } = req.body;
      const userId = req.user.userId;

      if (!companyId) {
        return res.status(400).json({ message: "companyId é obrigatório." });
      }

      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      // Verificar se o usuário realmente tem membership nesta empresa
      const membership = await storage.getMembership(userId, companyId);
      if (!membership) {
        return res.status(403).json({ message: "Você não tem acesso a esta empresa." });
      }

      const company = await storage.getCompanyById(companyId);

      // Gerar novo token com o novo companyId
      const token = jwt.sign({
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: companyId,
        companyRole: membership.role,
        sysVer: getSystemVersion()
      }, JWT_SECRET, { expiresIn: '24h' });

      // 🔐 Auditoria
      try {
        trackCompanyAudit({
          userId: user.id,
          companyId: companyId || null,
          userName: user.name,
          feature: "auth",
          action: "switch_company",
          description: `Trocou para empresa: ${company?.name || companyId}`,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
        });
      } catch (auditError) {
        console.error('⚠️ Erro ao registrar auditoria de troca:', auditError);
      }

      console.log(`🔄 [SWITCH-COMPANY] Usuário ${user.email} trocou para empresa ${company?.name} (ID: ${companyId})`);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin || false,
          requirePasswordChange: user.requirePasswordChange,
          companyId: companyId,
          companyRole: membership.role,
          company: company ? { id: company.id, name: company.name } : undefined,
          lgpdAccepted: user.lgpdAccepted,
          lgpdAcceptedAt: user.lgpdAcceptedAt,
          lgpdVersion: user.lgpdVersion,
        },
        token,
      });
    } catch (error: any) {
      console.error("❌ [SWITCH-COMPANY] Erro:", error);
      res.status(500).json({ message: error.message || "Erro ao trocar de empresa." });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Buscar memberships ATIVAS do usuário
      const memberships = await storage.getMembershipsByUserId(user.id);

      // 🔒 VALIDAÇÃO CRÍTICA: Verificar se o companyId do JWT ainda é válido
      let validatedCompanyId: number | undefined;
      let validatedCompanyRole: string | undefined;
      let company: any | undefined;

      if (req.user.companyId) {
        // Verificar se a membership ainda está ativa
        const currentMembership = memberships.find(m => m.companyId === req.user.companyId);
        
        if (currentMembership) {
          // Membership ainda ativa - usar dados do JWT
          validatedCompanyId = req.user.companyId;
          validatedCompanyRole = req.user.companyRole;
          company = await storage.getCompanyById(req.user.companyId);
          
          console.log(`✅ [AUTH/ME] Empresa atual validada: user ${user.id} → empresa ${validatedCompanyId}`);
        } else {
          // Membership INATIVA ou REMOVIDA - invalidar contexto de empresa
          validatedCompanyId = undefined;
          validatedCompanyRole = undefined;
          company = undefined;
          
          console.log(`⚠️ [AUTH/ME] Empresa atual INVÁLIDA: user ${user.id} → JWT tinha empresa ${req.user.companyId}, mas membership não está mais ativa`);
          console.log(`   - Memberships ativas do usuário: ${memberships.map(m => m.companyId).join(', ') || 'nenhuma'}`);
        }
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin || false,
        emailVerified: user.emailVerified,
        requirePasswordChange: user.requirePasswordChange,
        isActive: user.isActive,
        companyId: validatedCompanyId,  // ← VALIDADO: null se membership inativa
        companyRole: validatedCompanyRole,
        company: company ? {
          id: company.id,
          name: company.name,
        } : undefined,
        memberships: await Promise.all(memberships.map(async (m) => {
          const comp = await storage.getCompanyById(m.companyId);
          return {
            companyId: m.companyId,
            role: m.role,
            isActive: m.isActive,
            companyName: comp?.name || `Empresa #${m.companyId}`,
            companyCnpj: comp?.cnpj || '',
          };
        })),
        // 🔐 LGPD - Campos de aceite de termos
        lgpdAccepted: user.lgpdAccepted,
        lgpdAcceptedAt: user.lgpdAcceptedAt,
        lgpdVersion: user.lgpdVersion,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 🔐 LGPD - Endpoint para aceitar termos
  app.post("/api/lgpd/accept", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.userId;

      // Verificar se usuário existe
      const user = await storage.getUserById(userId);
      if (!user) {
        console.log(`❌ [LGPD] Usuário não encontrado: ${userId}`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Registrar aceite no banco
      await storage.acceptLgpd(userId, LGPD_VERSION);

      res.json({
        success: true,
        message: "Termos LGPD aceitos com sucesso",
        version: LGPD_VERSION,
        acceptedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("❌ [LGPD] Erro ao registrar aceite:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🏢 Multiempresa - Buscar convites pendentes do usuário autenticado
  app.get("/api/auth/my-invitations", authenticateToken, async (req: any, res) => {
    try {
      const userEmail = req.user.email; // Email do JWT (já vem normalizado)

      console.log(`📧 [MY INVITATIONS] Buscando convites para: ${userEmail}`);

      // Buscar todos os convites para este email
      const invitations = await storage.getInvitationsByEmail(userEmail);

      // Filtrar apenas pendentes e não expirados
      const now = new Date();
      const validInvitations = invitations.filter(inv => 
        inv.status === 'pending' && inv.expiresAt > now
      );

      console.log(`✅ [MY INVITATIONS] Encontrados ${validInvitations.length} convites válidos`);

      // Enriquecer com dados da empresa
      const enrichedInvitations = await Promise.all(
        validInvitations.map(async (inv) => {
          const company = await storage.getCompanyById(inv.companyId);
          return {
            id: inv.id,
            token: inv.token,
            email: inv.email,
            role: inv.role,
            company: company ? {
              id: company.id,
              name: company.name,
              cnpj: company.cnpj,
            } : null,
            displayName: inv.displayName,
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt,
            isExpired: false, // Já filtrado acima
          };
        })
      );

      res.json({
        invitations: enrichedInvitations,
      });
    } catch (error: any) {
      console.error("❌ [MY INVITATIONS] Erro:", error);
      res.status(500).json({ message: error.message || "Erro ao buscar convites" });
    }
  });

  // Clients routes
  app.get("/api/clients", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      // Se não houver parâmetros de paginação, retorna todos os clientes (compatibilidade)
      if (!req.query.page && !req.query.limit && !req.query.search) {
        const result = await storage.getAllClients(req.user.companyId);
        logEgressSize(req, result); // 📊 Instrumentação
        return res.json(result);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;

      let result;
      if (search && search.trim() !== '') {
        result = await storage.searchClients(search.trim(), req.user.companyId, page, limit);
      } else {
        // NOVO: Usar dual-read para retornar primaryAddress + addressCount
        result = await storage.getClientsWithPrimaryAddress(req.user.companyId, page, limit);
      }

      // 🔄 Transformar {data, total} em {items, pagination} para compatibilidade com frontend
      const totalPages = Math.ceil(result.total / limit);
      const response = {
        items: result.data,
        pagination: {
          page,
          pageSize: limit,
          total: result.total,
          totalPages
        }
      };

      logEgressSize(req, response); // 📊 Instrumentação
      res.json(response);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/search", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!q || typeof q !== 'string') {
        // Se não tiver query, retorna lista vazia ou paginada vazia
        return res.json({ data: [], total: 0 });
      }

      const result = await storage.searchClients(q.trim(), req.user.companyId, page, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);
      if (isNaN(clientId)) {
        return res.status(400).json({ message: "ID de cliente inválido" });
      }
      // NOVO: Dual-read - retorna cliente com addresses unificado
      const client = await storage.getClientWithAddresses(clientId, req.user.companyId);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/validate-cpf", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const cpf = req.query.cpf as string;
      console.log("Validação de CPF:", cpf);

      if (!cpf) {
        return res.json({ exists: false });
      }

      const existingClient = await storage.getClientByCpf(cpf, req.user.companyId);

      if (existingClient) {
        console.log("CPF já cadastrado:", cpf, "Nome:", existingClient.name);
        res.json({
          exists: true,
          clientName: existingClient.name,
          clientId: existingClient.id
        });
      } else {
        res.json({ exists: false });
      }
    } catch (error: any) {
      console.error("Erro na validação de CPF:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/clients", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const { addresses, ...clientData } = req.body;

      // Validar dados do cliente (sem endereços)
      const validatedClient = insertClientSchema.partial({ 
        cep: true, logradouro: true, numero: true, bairro: true, cidade: true, complemento: true, lat: true, lng: true 
      }).parse(clientData);

      // Validar endereços (obrigatório ter pelo menos 1)
      if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ message: "Cliente deve ter pelo menos 1 endereço" });
      }
      if (addresses.length > 5) {
        return res.status(400).json({ message: "Cliente pode ter no máximo 5 endereços" });
      }

      // Tipo explícito para endereço CREATE (sem id)
      type ValidatedAddressCreate = {
        cep: string;
        logradouro: string;
        numero: string;
        cidade: string;
        estado: string;
        bairro: string;
        lat?: number | null;
        complemento?: string | null;
        lng?: number | null;
        label?: string;
        isPrimary?: boolean;
      };

      // Validar cada endereço
      const validatedAddresses: ValidatedAddressCreate[] = addresses.map((addr: any) => 
        insertClientAddressSchema.parse(addr)
      );

      // Validar que exatamente 1 endereço é principal
      const primaryCount = validatedAddresses.filter((a) => a.isPrimary).length;
      if (primaryCount !== 1) {
        return res.status(400).json({ message: "Cliente deve ter exatamente 1 endereço principal" });
      }

      // Identificar endereço principal para sincronizar com campos legados
      const primaryAddress = validatedAddresses.find((a) => a.isPrimary);
      
      // GUARD: primaryAddress deve existir (validação já garantiu que existe exatamente 1)
      if (!primaryAddress) {
        return res.status(500).json({ message: "Erro interno: endereço principal não encontrado" });
      }

      // Criar cliente + endereços em transação
      const result = await db.transaction(async (tx) => {
        // 1. Criar cliente (SINCRONIZAR campos legados com endereço principal)
        const [client] = await tx.insert(clients).values({
          ...validatedClient,
          // COMPATIBILIDADE TEMPORÁRIA: sincronizar campos legados
          cep: primaryAddress.cep,
          logradouro: primaryAddress.logradouro,
          numero: primaryAddress.numero,
          complemento: primaryAddress.complemento ?? "",
          bairro: primaryAddress.bairro,
          cidade: primaryAddress.cidade,
          lat: primaryAddress.lat ?? null,
          lng: primaryAddress.lng ?? null,
          userId: req.user.userId,
          companyId: req.user.companyId,
        }).returning();

        // 2. Criar endereços (montando objeto explicitamente)
        const createdAddresses = [];
        for (const addr of validatedAddresses) {
          const [newAddress] = await tx.insert(clientAddresses).values({
            clientId: client.id,
            companyId: req.user.companyId,
            label: addr.label ?? null,
            cep: addr.cep,
            logradouro: addr.logradouro,
            numero: addr.numero,
            complemento: addr.complemento ?? null,
            bairro: addr.bairro,
            cidade: addr.cidade,
            estado: addr.estado,
            lat: addr.lat ?? null,
            lng: addr.lng ?? null,
            isPrimary: addr.isPrimary ?? false,
          }).returning();
          createdAddresses.push(newAddress);
        }

        return { client, addresses: createdAddresses };
      });

      trackFeatureUsage(req.user.userId, "clients", "create", req.user.companyId, { id: result.client.id });
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "clients",
        action: "create",
        resourceId: result.client.id,
        description: `Criou cliente "${result.client.name}" com ${result.addresses.length} endereço(s)`
      });

      res.json({ ...result.client, addresses: result.addresses });
    } catch (error: any) {
      console.error("❌ [POST /clients] erro:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/clients/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { addresses, ...clientData } = req.body;

      console.log("📝 [PUT /clients] payload recebido:", { id, hasAddresses: !!addresses, addressesCount: addresses?.length });

      // Validar dados do cliente
      const validatedClient = insertClientSchema.partial().parse(clientData);

      // Se addresses foi enviado, validar e atualizar
      if (addresses && Array.isArray(addresses)) {
        if (addresses.length === 0) {
          return res.status(400).json({ message: "Cliente deve ter pelo menos 1 endereço" });
        }
        if (addresses.length > 5) {
          return res.status(400).json({ message: "Cliente pode ter no máximo 5 endereços" });
        }

        // Tipos explícitos para endereços
        type ValidatedAddressCreate = {
          cep: string;
          logradouro: string;
          numero: string;
          cidade: string;
          estado: string;
          bairro: string;
          lat?: number | null;
          complemento?: string | null;
          lng?: number | null;
          label?: string;
          isPrimary?: boolean;
        };

        type ValidatedAddressUpdate = ValidatedAddressCreate & {
          id: number;
        };

        type ValidatedAddress = ValidatedAddressCreate | ValidatedAddressUpdate;

        // Type guard para detectar endereço com id
        const hasId = (addr: ValidatedAddress): addr is ValidatedAddressUpdate => {
          return 'id' in addr && typeof addr.id === 'number';
        };

        // Validar cada endereço (preservando id quando existir)
        const validatedAddresses: ValidatedAddress[] = addresses.map((addr: any) => {
          if (addr.id) {
            // UPDATE: validar campos, mas preservar id
            const validated = insertClientAddressSchema.partial().parse(addr);
            return { ...validated, id: addr.id } as ValidatedAddressUpdate;
          } else {
            // INSERT: validar campos completos
            return insertClientAddressSchema.parse(addr) as ValidatedAddressCreate;
          }
        });

        // Validar que exatamente 1 endereço é principal
        const primaryCount = validatedAddresses.filter((a) => a.isPrimary).length;
        if (primaryCount !== 1) {
          return res.status(400).json({ message: "Cliente deve ter exatamente 1 endereço principal" });
        }

        // Identificar endereço principal para sincronizar com campos legados
        const primaryAddress = validatedAddresses.find((a) => a.isPrimary);
        
        // GUARD: primaryAddress deve existir
        if (!primaryAddress) {
          return res.status(500).json({ message: "Erro interno: endereço principal não encontrado" });
        }

        // Atualizar cliente + endereços em transação
        const result = await db.transaction(async (tx) => {
          // 1. Atualizar dados principais do cliente + SINCRONIZAR campos legados
          const [updatedClient] = await tx.update(clients)
            .set({
              ...validatedClient,
              // COMPATIBILIDADE TEMPORÁRIA: sincronizar campos legados com endereço principal
              cep: primaryAddress.cep,
              logradouro: primaryAddress.logradouro,
              numero: primaryAddress.numero,
              complemento: primaryAddress.complemento ?? "",
              bairro: primaryAddress.bairro,
              cidade: primaryAddress.cidade,
              lat: primaryAddress.lat ?? null,
              lng: primaryAddress.lng ?? null,
            })
            .where(and(eq(clients.id, id), eq(clients.companyId, req.user.companyId)))
            .returning();

          if (!updatedClient) {
            throw new Error("Cliente não encontrado");
          }

          // 2. Buscar endereços existentes (VALIDAR company_id + clientId)
          const existing = await tx.select().from(clientAddresses)
            .where(and(
              eq(clientAddresses.clientId, id),
              eq(clientAddresses.companyId, req.user.companyId)
            ));

          const existingIds = existing.map(e => e.id);
          const incomingIds = validatedAddresses.filter(hasId).map((a) => a.id);

          // 3. DELETE endereços removidos (VALIDAR company_id)
          const toDelete = existingIds.filter(eid => !incomingIds.includes(eid));
          if (toDelete.length > 0) {
            await tx.delete(clientAddresses).where(and(
              inArray(clientAddresses.id, toDelete),
              eq(clientAddresses.companyId, req.user.companyId)
            ));
            console.log(`🗑️ Removidos ${toDelete.length} endereço(s)`);
          }

          // 4. INSERT novos, UPDATE existentes
          const updatedAddresses = [];
          for (const addr of validatedAddresses) {
            if (hasId(addr)) {
              // UPDATE (VALIDAR company_id + clientId) - montando objeto explicitamente
              const [updated] = await tx.update(clientAddresses)
                .set({
                  label: addr.label ?? null,
                  cep: addr.cep,
                  logradouro: addr.logradouro,
                  numero: addr.numero,
                  complemento: addr.complemento ?? null,
                  bairro: addr.bairro,
                  cidade: addr.cidade,
                  estado: addr.estado,
                  lat: addr.lat ?? null,
                  lng: addr.lng ?? null,
                  isPrimary: addr.isPrimary ?? false,
                })
                .where(and(
                  eq(clientAddresses.id, addr.id),
                  eq(clientAddresses.clientId, id),
                  eq(clientAddresses.companyId, req.user.companyId)
                ))
                .returning();
              
              if (!updated) {
                throw new Error(`Endereço ${addr.id} não encontrado ou não pertence a este cliente/empresa`);
              }
              updatedAddresses.push(updated);
            } else {
              // INSERT - montando objeto explicitamente
              const [newAddr] = await tx.insert(clientAddresses).values({
                clientId: id,
                companyId: req.user.companyId,
                label: addr.label ?? null,
                cep: addr.cep,
                logradouro: addr.logradouro,
                numero: addr.numero,
                complemento: addr.complemento ?? null,
                bairro: addr.bairro,
                cidade: addr.cidade,
                estado: addr.estado,
                lat: addr.lat ?? null,
                lng: addr.lng ?? null,
                isPrimary: addr.isPrimary ?? false,
              }).returning();
              updatedAddresses.push(newAddr);
            }
          }

          return { client: updatedClient, addresses: updatedAddresses };
        });

        trackFeatureUsage(req.user.userId, "clients", "update", req.user.companyId, { id: result.client.id });
        trackCompanyAudit({
          userId: req.user.userId,
          companyId: req.user.companyId,
          feature: "clients",
          action: "update",
          resourceId: result.client.id,
          description: `Atualizou cliente "${result.client.name}" (${result.addresses.length} endereço(s))`
        });

        return res.json({ ...result.client, addresses: result.addresses });
      }

      // Se não enviou addresses, atualizar apenas dados principais (compatibilidade legado)
      const client = await storage.updateClient(id, validatedClient, req.user.companyId);
      trackFeatureUsage(req.user.userId, "clients", "update", req.user.companyId, { id: client.id });
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "clients",
        action: "update",
        resourceId: client.id,
        description: `Atualizou cliente "${client.name}"`
      });

      res.json(client);
    } catch (error: any) {
      console.error("❌ [PUT /clients] erro:", error);
      res.status(400).json({ message: error.message });
    }
  });


  app.post("/api/clients/import", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const { clients } = req.body;
      if (!Array.isArray(clients)) {
        return res.status(400).json({ message: "Clients array is required" });
      }

      let successCount = 0;
      const detailedErrors: string[] = [];
      const processedItems: any[] = [];

      for (let i = 0; i < clients.length; i++) {
        const clientData = clients[i];
        try {
          console.log(`📝 Criando cliente: ${clientData.name}`);

          // 🔧 Normalizar e validar CEP antes de salvar
          if (clientData.cep) {
            const cepNormalizado = formatCep(clientData.cep);
            if (cepNormalizado) {
              clientData.cep = cepNormalizado;
              console.log(`  ✅ CEP normalizado: ${clientData.cep}`);
            } else {
              console.warn(`  ⚠️ CEP inválido (não tem 8 dígitos): "${clientData.cep}"`);
            }
          } else {
            console.warn(`  ⚠️ Cliente sem CEP`);
          }

          // 🔧 Validar campos obrigatórios não estejam vazios
          const camposVazios = [];
          if (!clientData.logradouro || clientData.logradouro.trim() === '') camposVazios.push('logradouro');
          if (!clientData.numero || clientData.numero.trim() === '') camposVazios.push('numero');
          if (!clientData.bairro || clientData.bairro.trim() === '') camposVazios.push('bairro');
          if (!clientData.cidade || clientData.cidade.trim() === '') camposVazios.push('cidade');

          if (camposVazios.length > 0) {
            console.warn(`  ⚠️ Cliente com campos vazios: ${camposVazios.join(', ')}`);
          }

          const validatedData = insertClientSchema.parse(clientData);
          const createdClient = await storage.createClient(validatedData, req.user.userId, req.user.companyId);

          successCount++;
          processedItems.push({
            index: i + 1,
            status: 'success',
            data: createdClient
          });

          console.log(`✅ Cliente criado: ${createdClient.name} (ID: ${createdClient.id})`);
        } catch (error: any) {
          console.log(`🔍 Analisando erro para cliente ${clientData.name}:`, error.message);

          // Melhorar mensagem de erro para CPFs duplicados
          let friendlyErrorMessage = error.message;

          if (error.message && (error.message.includes('clients_cpf_company_unique') || error.message.includes('clients_cpf_unique'))) {
            console.log(`🚫 CPF duplicado detectado: ${clientData.cpf || 'N/A'}`);
            friendlyErrorMessage = `Erro na importação: CPF ${clientData.cpf} já está cadastrado nesta empresa.`;
            console.log(`✏️ Mensagem de erro melhorada: ${friendlyErrorMessage}`);
          }

          detailedErrors.push(`Item ${i + 1}: Erro ao criar cliente "${clientData.name}" - ${friendlyErrorMessage}`);
          processedItems.push({
            index: i + 1,
            status: 'error',
            error: friendlyErrorMessage,
            data: clientData
          });
          console.log(`❌ Erro no cliente ${i + 1}: ${friendlyErrorMessage}`);
        }
      }

      console.log(`📊 Importação de clientes concluída para usuário ${req.user.userId}:`);
      console.log(`   • Total de itens: ${clients.length}`);
      console.log(`   • Sucessos: ${successCount}`);
      console.log(`   • Erros: ${detailedErrors.length}`);

      if (detailedErrors.length > 0) {
        console.log(`📋 Erros detalhados:`);
        detailedErrors.forEach(error => console.log(`   • ${error}`));
      }

      res.json({
        success: successCount,
        errors: detailedErrors.length,
        detailedErrors,
        processedItems
      });
    } catch (error: any) {
      console.error(`❌ Erro fatal na importação de clientes:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/clients/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteClient(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "clients",
        action: "delete",
        resourceId: id,
        description: `Excluiu cliente #${id}`
      });
      res.json({ message: "Client deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Services routes
  app.get("/api/services", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 25));
      const search = req.query.search as string;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const result = await storage.getServicesPaged(req.user.companyId, page, pageSize, search);
      logEgressSize(req, result);
      res.json(result);
    } catch (error: any) {
      console.error(" [SERVICES] Erro ao listar:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/services", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData, req.user.userId, req.user.companyId); // userId kept for INSERT
      trackFeatureUsage(req.user.userId, "services", "create", req.user.companyId, { id: service.id });
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "services",
        action: "create",
        resourceId: service.id,
        description: `Criou serviço "${service.name}"`
      });
      res.json(service);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/services/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const serviceData = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(id, serviceData, req.user.companyId);
      res.json(service);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/services/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteService(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Service not found" });
      }
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "services",
        action: "delete",
        resourceId: id,
        description: `Excluiu serviço #${id}`
      });
      res.json({ message: "Service deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Technicians routes
  app.get("/api/technicians", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 25));
      const search = req.query.search as string;
      const teamId = req.query.teamId ? parseInt(req.query.teamId as string) : undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const result = await storage.getTechniciansPaged(req.user.companyId, page, pageSize, search, isActive);
      logEgressSize(req, result);
      res.json(result);
    } catch (error: any) {
      console.error(" [TECHNICIANS] Erro ao listar:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/technicians", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    /* console.log("==== LOG INÍCIO: POST /api/technicians ===="); */
    /* console.log("Dados recebidos:"); */
    /* console.log(JSON.stringify(req.body, null, 2)); */

    try {
      const technicianData = insertTechnicianSchema.parse(req.body);
      console.log(" Dados validados pelo schema");

      const technician = await storage.createTechnician(technicianData, req.user.userId, req.user.companyId); // userId kept for INSERT
      /* console.log(" Técnico criado com sucesso:"); */
      /* console.log(`ID: ${technician.id}, Nome: ${technician.name}`); */
      /* console.log("==== LOG FIM: POST /api/technicians (SUCESSO) ===="); */

      trackFeatureUsage(req.user.userId, "technicians", "create", req.user.companyId, { id: technician.id });
      res.json(technician);
    } catch (error: any) {
      console.log(" ERRO ao criar técnico:");
      console.log("Tipo do erro:", error.constructor.name);
      console.log("Mensagem:", error.message);
      if (error.name === 'ZodError') {
        console.log("Erros de validação:");
        console.log(JSON.stringify(error.errors, null, 2));
      }
      /* console.log("==== LOG FIM: POST /api/technicians (ERRO) ===="); */

      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/technicians/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const technicianData = insertTechnicianSchema.partial().parse(req.body);
      const technician = await storage.updateTechnician(id, technicianData, req.user.companyId);
      res.json(technician);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/technicians/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTechnician(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Technician not found" });
      }
      res.json({ message: "Technician deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== TEAMS ROUTES ====================

  app.get("/api/teams", authenticateCompany, async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      const search = req.query.search as string;

      const result = await storage.getTeamsPaged(req.user.companyId, page, pageSize, search);
      logEgressSize(req, result);
      res.json(result);
    } catch (error: any) {
      console.error("❌ [TEAMS] Erro ao listar:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/teams/:id", authenticateCompany, async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const id = parseInt(req.params.id);
      const team = await storage.getTeam(id, req.user.companyId);
      if (!team) {
        return res.status(404).json({ message: "Equipe não encontrada" });
      }
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/teams", authenticateCompany, async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData, req.user.userId, req.user.companyId); // userId kept for INSERT
      trackFeatureUsage(req.user.userId, "teams", "create", req.user.companyId, { id: team.id });
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "teams",
        action: "create",
        resourceId: team.id,
        description: `Criou equipe "${team.name}"`
      });
      res.json(team);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/teams/:id", authenticateCompany, async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const id = parseInt(req.params.id);
      const teamData = insertTeamSchema.partial().parse(req.body);
      const team = await storage.updateTeam(id, teamData, req.user.companyId);
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "teams",
        action: "update",
        resourceId: team.id,
        description: `Atualizou equipe "${team.name}"`
      });
      res.json(team);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/teams/:id", authenticateCompany, async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const id = parseInt(req.params.id);
      const success = await storage.deleteTeam(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Equipe não encontrada" });
      }
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "teams",
        action: "delete",
        resourceId: id,
        description: `Excluiu equipe #${id}`
      });
      res.json({ message: "Equipe excluída com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Team Members
  app.get("/api/team-members", authenticateCompany, async (req: any, res) => {
    try {
      const teamMembers = await storage.getAllTeamMembers(req.user.companyId);
      res.json(teamMembers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== VEHICLES ROUTES ====================

  // 🔒 administrativo incluído para permitir acesso à tela de Prestadores quando vinculado a técnico
  app.get("/api/vehicles", authenticateCompany, requireRole(['admin', 'operador', 'prestador', 'tecnico', 'administrativo']), async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 50));
      const search = req.query.search as string;
      const responsibleType = req.query.responsibleType as string;
      const responsibleId = req.query.responsibleId ? parseInt(req.query.responsibleId as string) : undefined;

      const result = await storage.getVehiclesPaged(req.user.companyId, page, pageSize, search, responsibleType, responsibleId);

      // 🆕 Enriquecer com autorizações (técnicos e equipes autorizadas)
      const vehiclesWithAssignments = await Promise.all(
        result.items.map(async (vehicle: any) => {
          const assignments = await storage.getVehicleAssignments(vehicle.id, req.user.companyId);

          // Separar técnicos e equipes
          const authorizedTechnicianIds = assignments
            .filter(a => a.technicianId !== null)
            .map(a => a.technicianId as number);

          const authorizedTeamIds = assignments
            .filter(a => a.teamId !== null)
            .map(a => a.teamId as number);

          // Buscar nomes para exibição
          const technicianNames: string[] = [];
          const teamNames: string[] = [];

          if (authorizedTechnicianIds.length > 0) {
            const techs = await db.select({ id: technicians.id, name: technicians.name })
              .from(technicians)
              .where(and(inArray(technicians.id, authorizedTechnicianIds), eq(technicians.companyId, req.user.companyId)));
            technicianNames.push(...techs.map(t => t.name));
          }

          if (authorizedTeamIds.length > 0) {
            const teamsData = await db.select({ id: teams.id, name: teams.name })
              .from(teams)
              .where(and(inArray(teams.id, authorizedTeamIds), eq(teams.companyId, req.user.companyId)));
            teamNames.push(...teamsData.map(t => t.name));
          }

          return {
            ...vehicle,
            authorizedTechnicianIds,
            authorizedTeamIds,
            authorizedTechnicianNames: technicianNames,
            authorizedTeamNames: teamNames
          };
        })
      );

      const enrichedResult = {
        ...result,
        items: vehiclesWithAssignments
      };

      logEgressSize(req, enrichedResult);
      res.json(enrichedResult);
    } catch (error: any) {
      console.error("❌ [VEHICLES] Erro ao listar:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // 🆕 IMPORTANTE: Esta rota DEVE vir ANTES de /api/vehicles/:id
  // Caso contrário, Express interpreta "available-for-me" como um :id
  // 🔒 administrativo incluído para permitir acesso à tela de Prestadores quando vinculado a técnico
  app.get("/api/vehicles/available-for-me", authenticateCompany, requireRole(['admin', 'operador', 'prestador', 'tecnico', 'administrativo']), async (req: any, res) => {
    const requestTimestamp = new Date().toISOString();
    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[VEHICLE_AUTH][ROUTE] 🔍 INÍCIO - Requisição recebida em ${requestTimestamp}`);
      console.log(`[VEHICLE_AUTH][ROUTE] 📋 Dados do token JWT:`, {
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role,
        companyId: req.user?.companyId,
        fullUser: req.user
      });

      if (!req.user?.companyId) {
        console.error(`[VEHICLE_AUTH][ROUTE] ❌ ERRO: CompanyId ausente no token`);
        console.error(`[VEHICLE_AUTH][ROUTE] ❌ Token completo:`, req.user);
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }

      console.log(`[VEHICLE_AUTH][ROUTE] 🔎 Chamando storage.getVehiclesAvailableForUser com:`, {
        userId: req.user.userId,
        companyId: req.user.companyId
      });
      
      const availableVehicles = await storage.getVehiclesAvailableForUser(req.user.userId, req.user.companyId);
      
      console.log(`[VEHICLE_AUTH][ROUTE] ✅ Storage retornou ${availableVehicles.length} veículos`);
      if (availableVehicles.length > 0) {
        console.log(`[VEHICLE_AUTH][ROUTE] 🚗 Veículos encontrados:`, availableVehicles.map(v => ({
          id: v.id,
          plate: v.plate,
          model: v.model,
          brand: v.brand
        })));
      } else {
        console.warn(`[VEHICLE_AUTH][ROUTE] ⚠️ NENHUM veículo autorizado encontrado para userId=${req.user.userId}, companyId=${req.user.companyId}`);
      }
      
      console.log(`[VEHICLE_AUTH][ROUTE] 📤 Enviando resposta ao frontend`);
      console.log(`${'='.repeat(80)}\n`);
      
      res.json(availableVehicles);
    } catch (error: any) {
      console.error(`\n${'='.repeat(80)}`);
      console.error(`[VEHICLE_AUTH][ROUTE] ❌ ERRO ao buscar veículos disponíveis:`, error.message);
      console.error(`[VEHICLE_AUTH][ROUTE] ❌ Stack:`, error.stack);
      console.error(`[VEHICLE_AUTH][ROUTE] ❌ Request user:`, req.user);
      console.error(`${'='.repeat(80)}\n`);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/vehicles/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      const vehicle = await storage.getVehicle(id, req.user.companyId);
      if (!vehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }
      res.json(vehicle);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vehicles", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const { authorizedTechnicianIds, authorizedTeamIds, ...vehicleData } = req.body;
      const parsedVehicleData = insertVehicleSchema.parse(vehicleData);
      const vehicle = await storage.createVehicle(parsedVehicleData, req.user.userId, req.user.companyId);

      console.log(`✅ [VEHICLES] Veículo criado: ${vehicle.plate} (ID: ${vehicle.id})`);

      // 🆕 Sincronizar autorizações de uso
      if (authorizedTechnicianIds || authorizedTeamIds) {
        const techIds = Array.isArray(authorizedTechnicianIds) ? authorizedTechnicianIds : [];
        const teamIds = Array.isArray(authorizedTeamIds) ? authorizedTeamIds : [];

        await storage.syncVehicleAssignments(
          vehicle.id,
          techIds,
          teamIds,
          req.user.userId,
          req.user.companyId
        );

        console.log(`✅ [VEHICLES] Autorizações sincronizadas: ${techIds.length} técnicos, ${teamIds.length} equipes`);
      }

      trackFeatureUsage(req.user.userId, "vehicles", "create", req.user.companyId, { id: vehicle.id });
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "vehicles",
        action: "create",
        resourceId: vehicle.id,
        description: `Criou veículo "${vehicle.plate}"`
      });
      res.json(vehicle);
    } catch (error: any) {
      console.error("❌ [VEHICLES] Erro ao criar:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/vehicles/:id", authenticateCompany, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const id = parseInt(req.params.id);
      const { authorizedTechnicianIds, authorizedTeamIds, ...vehicleData } = req.body;
      const parsedVehicleData = insertVehicleSchema.parse(vehicleData) as Partial<InsertVehicle>;
      const vehicle = await storage.updateVehicle(id, parsedVehicleData, req.user.companyId);

      console.log(`✅ [VEHICLES] Veículo atualizado: ${vehicle.plate} (ID: ${vehicle.id})`);

      // 🆕 Sincronizar autorizações de uso
      if (authorizedTechnicianIds !== undefined || authorizedTeamIds !== undefined) {
        const techIds = Array.isArray(authorizedTechnicianIds) ? authorizedTechnicianIds : [];
        const teamIds = Array.isArray(authorizedTeamIds) ? authorizedTeamIds : [];

        await storage.syncVehicleAssignments(
          vehicle.id,
          techIds,
          teamIds,
          req.user.userId,
          req.user.companyId
        );

        console.log(`✅ [VEHICLES] Autorizações sincronizadas: ${techIds.length} técnicos, ${teamIds.length} equipes`);
      }

      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "vehicles",
        action: "update",
        resourceId: vehicle.id,
        description: `Atualizou veículo "${vehicle.plate}"`
      });
      res.json(vehicle);
    } catch (error: any) {
      console.error("❌ [VEHICLES] Erro ao atualizar:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/vehicles/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "Empresa inválida. Faça login novamente." });
      }
      const id = parseInt(req.params.id);
      const success = await storage.deleteVehicle(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "vehicles",
        action: "delete",
        resourceId: id,
        description: `Excluiu veículo #${id}`
      });
      res.json({ message: "Veículo excluído com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== VEHICLE DOCUMENTS ROUTES ====================

  // Lista documentos de um veículo
  app.get("/api/vehicles/:vehicleId/documents", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      const documents = await storage.getVehicleDocuments(vehicleId, req.user.companyId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Criar documento
  app.post("/api/vehicles/:vehicleId/documents", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);

      // Verificar se o veículo pertence à empresa
      const vehicle = await storage.getVehicle(vehicleId, req.user.companyId);
      if (!vehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }

      const documentData = {
        ...req.body,
        vehicleId,
        // Converter expirationDate de string para Date se existir
        expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : null,
      };

      const document = await storage.createVehicleDocument(documentData, req.user.userId, req.user.companyId); // userId kept for INSERT
      res.json(document);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Excluir documento
  app.delete("/api/vehicles/:vehicleId/documents/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVehicleDocument(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Documento não encontrado" });
      }
      res.json({ message: "Documento excluído com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== VEHICLE MAINTENANCES ROUTES ====================

  // Lista manutenções de um veículo
  app.get("/api/vehicles/:vehicleId/maintenances", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);
      const maintenances = await storage.getVehicleMaintenances(vehicleId, req.user.companyId);
      res.json(maintenances);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Buscar uma manutenção específica
  app.get("/api/vehicle-maintenances/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const maintenance = await storage.getVehicleMaintenance(id, req.user.companyId);
      if (!maintenance) {
        return res.status(404).json({ message: "Manutenção não encontrada" });
      }

      // Buscar também as garantias
      const warranties = await storage.getMaintenanceWarranties(id);

      res.json({ ...maintenance, warranties });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Criar manutenção
  app.post("/api/vehicles/:vehicleId/maintenances", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const vehicleId = parseInt(req.params.vehicleId);

      // Verificar se o veículo pertence à empresa
      const vehicle = await storage.getVehicle(vehicleId, req.user.companyId);
      if (!vehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }

      const { warranties, ...maintenanceData } = req.body;

      // Validar e transformar dados via Zod
      const validatedData = insertVehicleMaintenanceSchema.parse({
        ...maintenanceData,
        vehicleId,
      });

      const maintenance = await storage.createVehicleMaintenance(
        validatedData,
        req.user.userId,
        req.user.companyId
      );

      // Criar garantias se fornecidas
      if (warranties && Array.isArray(warranties)) {
        for (const warranty of warranties) {
          await storage.createMaintenanceWarranty({
            maintenanceId: maintenance.id,
            partName: warranty.partName,
            // O storage/schema já deve lidar com a conversão aqui se usássemos o schema de warranty, 
            // mas por segurança mantemos a conversão manual ou usamos o schema
            warrantyExpiration: warranty.warrantyExpiration ? new Date(warranty.warrantyExpiration) : new Date(),
          });
        }
      }

      // Buscar manutenção completa com garantias
      const fullMaintenance = await storage.getVehicleMaintenance(maintenance.id, req.user.companyId);
      const createdWarranties = await storage.getMaintenanceWarranties(maintenance.id);

      trackFeatureUsage(req.user.userId, "maintenances", "create", req.user.companyId, { id: maintenance.id });
      res.json({ ...fullMaintenance, warranties: createdWarranties });
    } catch (error: any) {
      console.error("❌ [MAINTENANCE] Erro ao criar manutenção:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Atualizar manutenção
  app.put("/api/vehicle-maintenances/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { warranties, ...maintenanceData } = req.body;

      // Schema base para update (sem refine)
      // Recriamos o schema parcial manualmente pois zod effects não suportam partial() direto
      const updateSchema = z.object({
        entryDate: z.union([z.string(), z.date()]).transform((val) => {
          if (typeof val === 'string') return new Date(val);
          return val;
        }).optional(),
        exitDate: z.union([z.string(), z.date(), z.null(), z.undefined()]).transform((val) => {
          if (!val) return null;
          if (typeof val === 'string') return new Date(val);
          return val;
        }).optional().nullable(),
        scheduledDate: z.union([z.string(), z.date(), z.null(), z.undefined()]).transform((val) => {
          if (!val) return null;
          if (typeof val === 'string') return new Date(val);
          return val;
        }).optional().nullable(),
        status: z.enum(["agendada", "concluida"]).optional(),
        laborCost: z.string().or(z.number()).optional(),
        materialsCost: z.string().or(z.number()).optional(),
        totalCost: z.string().or(z.number()).optional(),
        photos: z.array(z.string()).optional().nullable(),
        description: z.string().optional(),
        category: z.string().optional(),
        maintenanceType: z.string().optional(),
        vehicleKm: z.number().optional(),
        workshop: z.string().optional(),
        technicianResponsible: z.string().optional().nullable(),
        vehicleUnavailable: z.boolean().optional(),
        unavailableDays: z.number().optional(),
        affectedAppointments: z.boolean().optional(),
        invoiceNumber: z.string().optional().nullable(),
        observations: z.string().optional().nullable(),
      });

      // Usar schema construído manualmente para validar e transformar campos alterados
      const processedData = updateSchema.parse(maintenanceData);

      const maintenance = await storage.updateVehicleMaintenance(id, processedData, req.user.companyId);

      // Buscar garantias atuais
      const currentWarranties = await storage.getMaintenanceWarranties(id);

      res.json({ ...maintenance, warranties: currentWarranties });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Excluir manutenção
  app.delete("/api/vehicle-maintenances/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVehicleMaintenance(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Manutenção não encontrada" });
      }
      res.json({ message: "Manutenção excluída com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== MAINTENANCE WARRANTIES ROUTES ====================

  // Lista garantias de uma manutenção
  app.get("/api/vehicle-maintenances/:maintenanceId/warranties", authenticateToken, async (req: any, res) => {
    try {
      const maintenanceId = parseInt(req.params.maintenanceId);
      const warranties = await storage.getMaintenanceWarranties(maintenanceId);
      res.json(warranties);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Criar garantia
  app.post("/api/vehicle-maintenances/:maintenanceId/warranties", authenticateToken, async (req: any, res) => {
    try {
      const maintenanceId = parseInt(req.params.maintenanceId);

      // Verificar se a manutenção pertence à empresa
      const maintenance = await storage.getVehicleMaintenance(maintenanceId, req.user.companyId);
      if (!maintenance) {
        return res.status(404).json({ message: "Manutenção não encontrada" });
      }

      const warranty = await storage.createMaintenanceWarranty({
        maintenanceId,
        partName: req.body.partName,
        warrantyExpiration: req.body.warrantyExpiration,
      });

      res.json(warranty);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Excluir garantia
  app.delete("/api/vehicle-maintenances/warranties/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteMaintenanceWarranty(id);
      if (!success) {
        return res.status(404).json({ message: "Garantia não encontrada" });
      }
      res.json({ message: "Garantia excluída com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Appointments routes
  app.get("/api/appointments", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const startTime = Date.now();

      // =================================================================================
      // PARÂMETROS DE QUERY
      // =================================================================================
      const isLegacy = req.headers['x-legacy-list'] === '1';

      // Datas: from/to (YYYY-MM-DD)
      let fromParam = req.query.from as string | undefined;
      let toParam = req.query.to as string | undefined;

      // Status (string, sem enum fixo - aceita qualquer valor do schema)
      const statusParam = req.query.status as string | undefined;

      // Filtro por responsável (técnico ou equipe)
      const assignedType = req.query.assignedType as string | undefined;
      const assignedId = req.query.assignedId ? parseInt(req.query.assignedId as string, 10) : undefined;

      // Paginação
      let page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      let pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string, 10) || 25));

      // =================================================================================
      // MODO LEGACY: Limitar egress forçadamente
      // =================================================================================
      if (isLegacy) {
        console.warn(`⚠️ [APPOINTMENTS] Modo LEGACY ativo (header x-legacy-list). Endpoint será descontinuado.`);

        // Forçar limite de 30 dias se não vier from/to
        if (!fromParam && !toParam) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          fromParam = thirtyDaysAgo.toISOString().split('T')[0];
          console.log(`⚠️ [APPOINTMENTS/LEGACY] Sem from/to, forçando from=${fromParam}`);
        }
      }

      // =================================================================================
      // CONSTRUIR FILTROS
      // =================================================================================
      const conditions: any[] = [eq(appointments.companyId, req.user.companyId)];

      // Filtro de data: from
      if (fromParam) {
        const fromDate = new Date(fromParam);
        if (!isNaN(fromDate.getTime())) {
          fromDate.setHours(0, 0, 0, 0);
          conditions.push(gte(appointments.scheduledDate, fromDate));
        }
      } else {
        // Padrão: últimos 6 meses (se não for legacy)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        conditions.push(gte(appointments.scheduledDate, sixMonthsAgo));
      }

      // Filtro de data: to
      if (toParam) {
        const toDate = new Date(toParam);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          conditions.push(lte(appointments.scheduledDate, toDate));
        }
      }

      // Filtro de status (string, não enum)
      if (statusParam && statusParam.trim()) {
        conditions.push(eq(appointments.status, statusParam.trim()));
      }

      // Filtro de responsável (técnico ou equipe)
      if (assignedType && assignedId && Number.isFinite(assignedId)) {
        if (assignedType === 'technician') {
          conditions.push(eq(appointments.technicianId, assignedId));
        } else if (assignedType === 'team') {
          conditions.push(eq(appointments.teamId, assignedId));
        }
        // Se assignedType inválido, ignora silenciosamente
      }

      // =================================================================================
      // MODO LEGACY: Retornar array direto (com limite)
      // =================================================================================
      if (isLegacy) {
        const LEGACY_LIMIT = 300;

        const appointmentsList = await db
          .select()
          .from(appointments)
          .where(and(...conditions))
          .orderBy(desc(appointments.scheduledDate))
          .limit(LEGACY_LIMIT);

        if (appointmentsList.length === 0) {
          logEgressSize(req, []);
          return res.json([]);
        }

        // Buscar routeInfo em batch
        const appointmentIds = appointmentsList.map(a => a.id);
        const routeInfos = await db
          .select({
            appointmentId: routeStops.appointmentNumericId,
            routeId: routes.id,
            routeStatus: routes.status,
            routeDisplayNumber: routes.displayNumber,
          })
          .from(routeStops)
          .innerJoin(routes, eq(routeStops.routeId, routes.id))
          .where(and(
            inArray(routeStops.appointmentNumericId, appointmentIds),
            or(eq(routes.status, 'confirmado'), eq(routes.status, 'finalizado'))
          ));

        const routeInfoMap = new Map<number, { routeId: string; status: string | null; displayNumber: number | null }>();
        for (const ri of routeInfos) {
          if (ri.appointmentId && !routeInfoMap.has(ri.appointmentId)) {
            routeInfoMap.set(ri.appointmentId, {
              routeId: ri.routeId,
              status: ri.routeStatus,
              displayNumber: ri.routeDisplayNumber,
            });
          }
        }

        const result = appointmentsList.map(apt => ({
          ...apt,
          routeInfo: routeInfoMap.get(apt.id) || null,
        }));

        const totalTime = Date.now() - startTime;
        console.log(`⚠️ [APPOINTMENTS/LEGACY] Retornando ${result.length} agendamentos em ${totalTime}ms (LIMITE: ${LEGACY_LIMIT})`);

        logEgressSize(req, result);
        return res.json(result);
      }

      // =================================================================================
      // MODO PAGINADO: Resposta estruturada { items, pagination }
      // =================================================================================

      // Primeiro: contar total para paginação
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(...conditions));

      const total = countResult?.count ?? 0;
      const totalPages = Math.ceil(total / pageSize) || 1;

      // Ajustar página se estiver além do limite
      if (page > totalPages) {
        page = totalPages;
      }

      const offset = (page - 1) * pageSize;

      // Buscar página atual (campos otimizados para lista)
      const appointmentsList = await db
        .select({
          id: appointments.id,
          scheduledDate: appointments.scheduledDate,
          status: appointments.status,
          clientId: appointments.clientId,
          serviceId: appointments.serviceId,
          technicianId: appointments.technicianId,
          teamId: appointments.teamId,
          logradouro: appointments.logradouro,
          numero: appointments.numero,
          bairro: appointments.bairro,
          cidade: appointments.cidade,
          cep: appointments.cep,
          notes: appointments.notes,
          paymentStatus: appointments.paymentStatus,
          executionStatus: appointments.executionStatus,
        })
        .from(appointments)
        .where(and(...conditions))
        .orderBy(desc(appointments.scheduledDate))
        .limit(pageSize)
        .offset(offset);

      // Early return se não houver resultados
      if (appointmentsList.length === 0) {
        const response = {
          items: [],
          pagination: { page, pageSize, total, totalPages },
        };
        logEgressSize(req, response);
        return res.json(response);
      }

      // Buscar routeInfo em batch
      const appointmentIds = appointmentsList.map(a => a.id);
      const routeInfos = await db
        .select({
          appointmentId: routeStops.appointmentNumericId,
          routeId: routes.id,
          routeStatus: routes.status,
          routeDisplayNumber: routes.displayNumber,
        })
        .from(routeStops)
        .innerJoin(routes, eq(routeStops.routeId, routes.id))
        .where(and(
          inArray(routeStops.appointmentNumericId, appointmentIds),
          or(eq(routes.status, 'confirmado'), eq(routes.status, 'finalizado'))
        ));

      const routeInfoMap = new Map<number, { routeId: string; status: string | null; displayNumber: number | null }>();
      for (const ri of routeInfos) {
        if (ri.appointmentId && !routeInfoMap.has(ri.appointmentId)) {
          routeInfoMap.set(ri.appointmentId, {
            routeId: ri.routeId,
            status: ri.routeStatus,
            displayNumber: ri.routeDisplayNumber,
          });
        }
      }

      const items = appointmentsList.map(apt => ({
        ...apt,
        routeInfo: routeInfoMap.get(apt.id) || null,
      }));

      const response = {
        items,
        pagination: { page, pageSize, total, totalPages },
      };

      const totalTime = Date.now() - startTime;
      if (totalTime > 1000) {
        console.log(`⚠️ [APPOINTMENTS] Consulta lenta: página ${page}/${totalPages} (${items.length} de ${total}) em ${totalTime}ms`);
      } else {
        console.log(`✅ [APPOINTMENTS] Página ${page}/${totalPages}: ${items.length} itens (total: ${total}) em ${totalTime}ms`);
      }

      logEgressSize(req, response);
      res.json(response);
    } catch (error: any) {
      console.error(`❌ [APPOINTMENTS] Erro ao buscar agendamentos:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/appointments/date/:date", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const date = req.params.date;
      const appointments = await storage.getAppointmentsByDate(date, req.user.companyId);
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/appointments", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const appointmentData = extendedInsertAppointmentSchema.parse(req.body);

      console.log(`📋 [APPOINTMENTS POST] companyId=${req.user.companyId}, technicianId=${appointmentData.technicianId || 'N/A'}, teamId=${appointmentData.teamId || 'N/A'}`);

      // Validar restrição de data (feriados / indisponibilidades)
      const dateRestrictionValidation = await validateDateRestriction(
        req.user.userId,
        new Date(appointmentData.scheduledDate),
        appointmentData.technicianId || null,
        appointmentData.teamId || null,
        req.user.companyId
      );

      if (!dateRestrictionValidation.valid) {
        return res.status(400).json({ message: dateRestrictionValidation.message });
      }

      // Validar conflito técnico/equipe
      const validation = await validateTechnicianTeamConflict(
        req.user.userId,
        new Date(appointmentData.scheduledDate),
        appointmentData.technicianId || null,
        appointmentData.teamId || null,
        undefined,
        req.user.companyId
      );

      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      // Validar horário de trabalho (dias e horários)
      const workScheduleValidation = await validateWorkSchedule(
        storage,
        req.user.userId,
        new Date(appointmentData.scheduledDate),
        appointmentData.technicianId || undefined,
        appointmentData.teamId || undefined,
        req.user.companyId
      );

      if (!workScheduleValidation.valid) {
        return res.status(400).json({ message: workScheduleValidation.message });
      }

      const appointment = await storage.createAppointment(appointmentData, req.user.userId, req.user.companyId); // userId kept for INSERT

      // Atualizar disponibilidade após criar agendamento
      await updateAvailabilityForAppointment(req.user.userId, appointment, req.user.companyId);

      trackFeatureUsage(req.user.userId, "appointments", "create", req.user.companyId, { id: appointment.id });
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "appointments",
        action: "create",
        resourceId: appointment.id,
        description: `Criou agendamento #${appointment.id}`
      });
      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/appointments/import", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const { appointments } = req.body;
      if (!Array.isArray(appointments)) {
        return res.status(400).json({ message: "Appointments array is required" });
      }

      let successCount = 0;
      const detailedErrors: string[] = [];
      const processedItems: any[] = [];

      for (let i = 0; i < appointments.length; i++) {
        const appointmentData = appointments[i];
        try {
          let clientId = appointmentData.clientId;

          // Criar cliente automaticamente se necessário
          if (!clientId && appointmentData.clientData) {
            try {
              const newClient = await storage.createClient(appointmentData.clientData, req.user.userId, req.user.companyId);
              clientId = newClient.id;
              console.log(`📝 Cliente criado automaticamente: ${appointmentData.clientData.name} (ID: ${clientId})`);
            } catch (clientError: any) {
              detailedErrors.push(`Item ${i + 1}: Erro ao criar cliente "${appointmentData.clientData.name}" - ${clientError.message}`);
              processedItems.push({
                index: i + 1,
                status: 'error',
                error: `Erro ao criar cliente: ${clientError.message}`,
                data: appointmentData
              });
              continue;
            }
          }

          // Preparar dados do agendamento com clientId correto
          const { clientData, ...cleanAppointmentData } = appointmentData;
          cleanAppointmentData.clientId = clientId;

          console.log(`🔧 Criando agendamento com clientId: ${cleanAppointmentData.clientId}`);
          const validatedData = extendedInsertAppointmentSchema.parse(cleanAppointmentData);

          // Validar restrição de data (feriados / indisponibilidades)
          const dateRestrictionValidation = await validateDateRestriction(
            req.user.userId,
            new Date(validatedData.scheduledDate),
            validatedData.technicianId || null,
            validatedData.teamId || null,
            req.user.companyId
          );

          if (!dateRestrictionValidation.valid) {
            detailedErrors.push(`Item ${i + 1}: ${dateRestrictionValidation.message}`);
            processedItems.push({
              index: i + 1,
              status: 'error',
              error: dateRestrictionValidation.message,
              data: appointmentData
            });
            continue;
          }

          // Validar conflito técnico/equipe
          const validation = await validateTechnicianTeamConflict(
            req.user.userId,
            new Date(validatedData.scheduledDate),
            validatedData.technicianId || null,
            validatedData.teamId || null,
            undefined,
            req.user.companyId
          );

          if (!validation.valid) {
            detailedErrors.push(`Item ${i + 1}: ${validation.message}`);
            processedItems.push({
              index: i + 1,
              status: 'error',
              error: validation.message,
              data: appointmentData
            });
            continue;
          }

          // Validar horário de trabalho (dias e horários)
          const workScheduleValidation = await validateWorkSchedule(
            storage,
            req.user.userId,
            new Date(validatedData.scheduledDate),
            validatedData.technicianId || undefined,
            validatedData.teamId || undefined,
            req.user.companyId
          );

          if (!workScheduleValidation.valid) {
            detailedErrors.push(`Item ${i + 1}: ${workScheduleValidation.message}`);
            processedItems.push({
              index: i + 1,
              status: 'error',
              error: workScheduleValidation.message,
              data: appointmentData
            });
            continue;
          }

          const createdAppointment = await storage.createAppointment(validatedData, req.user.userId, req.user.companyId); // userId kept for INSERT

          // Atualizar disponibilidade após criar agendamento
          await updateAvailabilityForAppointment(req.user.userId, createdAppointment, req.user.companyId);

          console.log(`✅ Agendamento criado: ID ${createdAppointment.id}, clientId: ${createdAppointment.clientId}`);
          successCount++;
          processedItems.push({
            index: i + 1,
            status: 'success',
            appointment: createdAppointment
          });
        } catch (error: any) {
          let errorMessage = `Item ${i + 1}: `;

          if (error.name === 'ZodError') {
            // Erro de validação do Zod - extrair detalhes específicos
            const zodErrors = error.errors.map((err: any) => {
              const field = err.path.join('.');
              return `${field}: ${err.message}`;
            });
            errorMessage += `Erro de validação - ${zodErrors.join('; ')}`;
          } else if (error.code === '23505') {
            // Erro de duplicação no PostgreSQL
            errorMessage += `Agendamento duplicado`;
          } else if (error.code === '23503') {
            // Erro de chave estrangeira
            errorMessage += `Referência inválida (cliente, serviço ou técnico não existe)`;
          } else {
            errorMessage += `${error.message || 'Erro desconhecido'}`;
          }

          detailedErrors.push(errorMessage);
          processedItems.push({
            index: i + 1,
            status: 'error',
            error: errorMessage,
            data: appointmentData
          });
        }
      }

      // Log detalhado no servidor
      console.log(`📊 Importação CSV concluída para usuário ${req.user.userId}:`);
      console.log(`   • Total de itens: ${appointments.length}`);
      console.log(`   • Sucessos: ${successCount}`);
      console.log(`   • Erros: ${detailedErrors.length}`);

      if (detailedErrors.length > 0) {
        console.log(`📋 Erros detalhados:`);
        detailedErrors.forEach(error => console.log(`   • ${error}`));
      }

      res.json({
        success: successCount,
        errors: detailedErrors.length,
        detailedErrors,
        processedItems
      });
    } catch (error: any) {
      console.error(`❌ Erro fatal na importação CSV:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/appointments/:id - Obter detalhes de um agendamento específico
  app.get("/api/appointments/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      // Validate that id is numeric to avoid conflict with other routes
      if (isNaN(Number(req.params.id))) {
        return res.status(404).json({ message: "Agendamento não encontrado - ID inválido" });
      }

      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id, req.user.companyId);
      // Also allow getting appointment if user is admin (implemented via storage.getAppointment checking userId currently, 
      // but maybe we need broader access? For now, keep STRICT owner check as per rules)

      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }
      res.json(appointment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/appointments/:id/history - Obter histórico de um agendamento
  app.get("/api/appointments/:id/history", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // First check if appointment exists and user has access
      const appointment = await storage.getAppointment(id, req.user.companyId);
      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      const history = await storage.getAppointmentHistory(id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // 🔍 [ENCONTRE UMA DATA] Endpoint para buscar datas disponíveis (streaming)
  app.post("/api/scheduling/find-available-dates", authenticateToken, async (req: any, res) => {
    try {
      const { clientId, cep, numero, logradouro, bairro, cidade, estado, serviceId, technicianId, teamId, startDate } = req.body;
      const userId = req.user.userId;
      const companyId = req.user.companyId;

      console.log("🔍 [FIND-DATE] Iniciando busca de datas disponíveis:", { clientId, cep, numero, logradouro, cidade, serviceId, technicianId, teamId });

      // Headers removidos daqui para evitar envio antes da validação


      // Validações básicas
      if (!cep || !numero || !serviceId) {
        return res.status(400).json({ message: "CEP, número e serviço são obrigatórios" });
      }

      // Buscar serviço para obter duração
      const service = await storage.getService(serviceId, companyId);
      if (!service) {
        return res.status(400).json({ message: "Serviço não encontrado" });
      }

      // Buscar regras de negócio
      const businessRules = await storage.getBusinessRules(companyId);
      if (!businessRules) {
        return res.status(400).json({ message: "Regras de negócio não configuradas" });
      }

      // 🆕 Distâncias separadas: OSRM (real) vs Haversine (pré-filtro)
      const maxDistanceOsrm = parseFloat((businessRules as any).distanciaMaximaEntrePontosOsrm || businessRules.distanciaMaximaEntrePontos || "50");
      const maxDistanceHaversine = parseFloat((businessRules as any).distanciaMaximaEntrePontosHaversine || String(maxDistanceOsrm * 0.8));
      const maxDistanceServed = parseFloat(businessRules.distanciaMaximaAtendida || "100");
      // Reset OSRM stats for this request
      osrmStats.reset();

      // 🔒 [PLAN-LIMITS] Buscar plano do usuário para aplicar limites
      let userPlan = 'basic'; // default
      if (companyId) {
        const company = await db.query.companies.findFirst({
          where: eq(companies.id, companyId)
        });
        if (company) userPlan = company.plan || 'basic';
      } else {
        const userRecord = await storage.getUserById(userId);
        if (userRecord) userPlan = userRecord.plan || 'basic';
      }
      const planLimits = getPlanLimits(userPlan);
      console.log(`🔒 [FIND-DATE] Plano: ${userPlan} | Limites: ${planLimits.maxFindDateOsrmDays} dias OSRM, ${planLimits.maxFindDateResponsiblesPerDay} responsáveis/dia`);

      // Flag para indicar se técnico/equipe específico foi selecionado (desabilita limite por dia)
      const specificResponsibleSelected = !!(technicianId || teamId);

      let targetLat: number, targetLng: number;

      if (clientId) {
        // Buscar coordenadas do cliente
        const client = await storage.getClient(clientId, companyId);
        if (!client) {
          return res.status(400).json({ message: "Cliente não encontrado" });
        }

        if (client.lat && client.lng) {
          targetLat = client.lat;
          targetLng = client.lng;
        } else {
          // Geocodificar endereço do cliente
          const cepFormatado = formatCep(client.cep);
          const fullAddress = `${client.logradouro}, ${client.numero}, ${client.cidade}, ${cepFormatado}, Brasil`;
          console.log("📍 [FIND-DATE] Geocodificando endereço do cliente:", fullAddress);
          await sleep(1000); // Rate limit Nominatim
          const coords = await geocodeWithNominatim(fullAddress);
          targetLat = coords.lat;
          targetLng = coords.lng;

          // Atualizar coordenadas do cliente
          await db.update(clients).set({ lat: targetLat, lng: targetLng }).where(eq(clients.id, clientId));
        }
      } else {
        // Geocodificar endereço manual - USAR ENDEREÇO COMPLETO como no cadastro de clientes
        // Formato: Logradouro, Número, Cidade, CEP, Brasil
        const cepFormatado = formatCep(cep);
        const fullAddress = logradouro && cidade
          ? `${logradouro}, ${numero}, ${cidade}, ${cepFormatado}, Brasil`
          : `${cepFormatado}, ${numero}, Brasil`;

        console.log("📍 [FIND-DATE] Geocodificando endereço manual:", fullAddress);
        await sleep(1000); // Rate limit Nominatim
        const coords = await geocodeWithNominatim(fullAddress);
        targetLat = coords.lat;
        targetLng = coords.lng;
      }

      console.log("✅ [FIND-DATE] Coordenadas do destino:", { targetLat, targetLng });

      // 🆕 Nota: Funções de distância importadas de osrm-distance-helper.ts
      // (osrmHaversineDistance, calculateOSRMDistance, haversinePreFilter)

      // Buscar técnicos/equipes compatíveis com o serviço
      let responsibles: Array<{ type: 'technician' | 'team', id: number, name: string }> = [];

      if (technicianId) {
        // Técnico específico
        const tech = await storage.getTechnician(technicianId, companyId);
        if (tech && tech.serviceIds?.includes(serviceId.toString())) {
          responsibles.push({ type: 'technician', id: tech.id, name: tech.name });
        }
      } else if (teamId) {
        // Equipe específica
        const team = await storage.getTeam(teamId, companyId);
        if (team && team.serviceIds?.includes(serviceId.toString())) {
          responsibles.push({ type: 'team', id: team.id, name: team.name });
        }
      } else {
        // Buscar todos os técnicos compatíveis
        const allTechnicians = await storage.getTechnicians(companyId);
        
        console.log(`\n [FIND-DATE][LOAD] Técnicos carregados do banco: ${allTechnicians.length}`);
        console.log(` [FIND-DATE][FILTER] Serviço solicitado ID: ${serviceId} (tipo: ${typeof serviceId})`);
        
        for (const tech of allTechnicians) {
          const serviceIdStr = serviceId.toString();
          const serviceIdsArray = Array.isArray(tech.serviceIds) ? tech.serviceIds : [];
          const hasServiceIds = serviceIdsArray.length > 0;
          const includesService = hasServiceIds && serviceIdsArray.includes(serviceIdStr);
          const isActive = tech.isActive === true;
          
          console.log(`\n  [TÉCNICO] ${tech.name} (ID: ${tech.id})`);
          console.log(`     - serviceIds: ${hasServiceIds ? `[${serviceIdsArray.join(', ')}]` : 'null/undefined'}`);
          console.log(`     - isActive: ${tech.isActive}`);
          console.log(`     - linkedUserId: ${tech.linkedUserId || 'null'}`);
          console.log(`     - Inclui serviço ${serviceIdStr}? ${includesService}`);
          
          if (!isActive) {
            console.log(`     [DESCARTADO] Técnico está inativo (isActive = ${tech.isActive})`);
            continue;
          }
          
          if (!hasServiceIds) {
            console.log(`     [DESCARTADO] Sem serviços vinculados (serviceIds = ${tech.serviceIds ?? 'null'})`);
            continue;
          }
          
          if (!includesService) {
            console.log(`     [DESCARTADO] Não atende o serviço ${serviceIdStr}. Serviços: [${serviceIdsArray.join(', ')}]`);
            continue;
          }
          
          console.log(`     [INCLUÍDO] Técnico elegível para o serviço`);
          responsibles.push({ type: 'technician', id: tech.id, name: tech.name });
        }

        // Buscar todas as equipes compatíveis
        const allTeams = await storage.getTeams(companyId);
        
        console.log(`\n [FIND-DATE][LOAD] Equipes carregadas do banco: ${allTeams.length}`);
        
        for (const team of allTeams) {
          const serviceIdStr = serviceId.toString();
          const serviceIdsArray = Array.isArray(team.serviceIds) ? team.serviceIds : [];
          const hasServiceIds = serviceIdsArray.length > 0;
          const includesService = hasServiceIds && serviceIdsArray.includes(serviceIdStr);
          
          console.log(`\n  [EQUIPE] ${team.name} (ID: ${team.id})`);
          console.log(`     - serviceIds: ${hasServiceIds ? `[${serviceIdsArray.join(', ')}]` : 'null/undefined'}`);
          console.log(`     - Inclui serviço ${serviceIdStr}? ${includesService}`);
          
          if (!hasServiceIds) {
            console.log(`     [DESCARTADO] Sem serviços vinculados`);
            continue;
          }
          
          if (!includesService) {
            console.log(`     ❌ [DESCARTADO] Não atende o serviço ${serviceIdStr}. Serviços: [${serviceIdsArray.join(', ')}]`);
            continue;
          }
          
          console.log(`     ✅ [INCLUÍDO] Equipe elegível para o serviço`);
          responsibles.push({ type: 'team', id: team.id, name: team.name });
        }
      }

      if (responsibles.length === 0) {
        // NEW: Mensagem detalhada para o usuário entender que falta vínculo no cadastro
        return res.status(400).json({
          message: "Nenhum técnico ou equipe habilitado para realizar este serviço. Verifique se o serviço está vinculado a algum prestador no cadastro."
        });
      }

      // ✅ Validações concluídas, iniciar streaming SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      console.log(`✅ [FIND-DATE] Encontrados ${responsibles.length} responsáveis compatíveis`);

      // Contadores de rejeição para log final
      const stats = {
        checkedDays: 0,
        skippedNotWorkDay: 0,
        skippedNoTime: 0,
        skippedHaversinePreFilter: 0, // 🆕 Rejeitados pelo pré-filtro Haversine
        skippedOsrmTooFar: 0,          // 🆕 Rejeitados pela distância OSRM real
        skippedGeocodeError: 0,
        foundCandidates: 0
      };

      // Buscar datas candidatas
      const today = new Date();
      // 🐛 FIX: Parsear data como local para evitar shift de fuso horário UTC (ex: dia 20 virar dia 19)
      // Adicionando T00:00:00 garantimos que o new Date considere o início do dia no fuso local do servidor
      const searchStartDate = startDate
        ? new Date(`${startDate.split('T')[0]}T00:00:00`)
        : today;
      const maxDaysAhead = 100;
      const candidates: Array<{
        date: string;
        responsibleType: 'technician' | 'team';
        responsibleId: number;
        responsibleName: string;
        availableMinutes: number;
        totalMinutes: number;
        usedMinutes: number;
        distance: number;
        distanceType: 'between_points' | 'from_base';
      }> = [];

      const debugLog = (msg: string) => {
        const logFile = path.join(process.cwd(), 'debug_find_date.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
      };

      debugLog(`🚀 Starting Find Date Search for Service ${serviceId}`);
      debugLog(`Found ${responsibles.length} responsibles: ${responsibles.map(r => `${r.name} (${r.type})`).join(', ')}`);

      // 🔄 REFACTOR: Loop invertido (Data > Responsável) para priorizar datas próximas
      // Isso garante que se uma equipe está livre amanhã, ela apareça antes de um técnico livre daqui a 30 dias.
      // 🚀 PERFORMANCE FIX: "Lazy Loading" de disponibilidade.
      // Em vez de pré-calcular 100 dias para todos (que demora), calculamos apenas o dia/prestador da vez.

      const preparedResponsibles: Array<{
        info: typeof responsibles[0];
        baseAddress: { cep: string, logradouro: string, numero: string, bairro: string, cidade: string, estado: string };
        diasTrabalho: string[];
      }> = [];

      const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

      // debugLog(`Preparing data for ${responsibles.length} responsibles...`);

      // 1. FASE DE PREPARAÇÃO: Carregar apenas Metadados (rápido)
      for (const responsible of responsibles) {
        // Buscar horários de trabalho
        let horarioInicioTrabalho: string, horarioFimTrabalho: string, horarioAlmocoMinutos: number, diasTrabalho: string[];
        let baseAddress: { cep: string, logradouro: string, numero: string, bairro: string, cidade: string, estado: string };

        if (responsible.type === 'technician') {
          const tech = await storage.getTechnician(responsible.id, companyId);
          if (!tech) continue;

          horarioInicioTrabalho = tech.horarioInicioTrabalho || '08:00';
          horarioFimTrabalho = tech.horarioFimTrabalho || '18:00';
          horarioAlmocoMinutos = tech.horarioAlmocoMinutos || 60;
          diasTrabalho = tech.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

          if (tech.enderecoInicioCep) {
            baseAddress = {
              cep: tech.enderecoInicioCep,
              logradouro: tech.enderecoInicioLogradouro || '',
              numero: tech.enderecoInicioNumero || '',
              bairro: tech.enderecoInicioBairro || '',
              cidade: tech.enderecoInicioCidade || '',
              estado: tech.enderecoInicioEstado || ''
            };
          } else {
            baseAddress = {
              cep: businessRules.enderecoEmpresaCep,
              logradouro: businessRules.enderecoEmpresaLogradouro,
              numero: businessRules.enderecoEmpresaNumero,
              bairro: businessRules.enderecoEmpresaBairro,
              cidade: businessRules.enderecoEmpresaCidade,
              estado: businessRules.enderecoEmpresaEstado
            };
          }
        } else {
          const team = await storage.getTeam(responsible.id, companyId);
          if (!team) continue;

          horarioInicioTrabalho = team.horarioInicioTrabalho || '08:00';
          horarioFimTrabalho = team.horarioFimTrabalho || '18:00';
          horarioAlmocoMinutos = team.horarioAlmocoMinutos || 60;
          diasTrabalho = team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

          if (team.enderecoInicioCep) {
            baseAddress = {
              cep: team.enderecoInicioCep,
              logradouro: team.enderecoInicioLogradouro || '',
              numero: team.enderecoInicioNumero || '',
              bairro: team.enderecoInicioBairro || '',
              cidade: team.enderecoInicioCidade || '',
              estado: team.enderecoInicioEstado || ''
            };
          } else {
            baseAddress = {
              cep: businessRules.enderecoEmpresaCep,
              logradouro: businessRules.enderecoEmpresaLogradouro,
              numero: businessRules.enderecoEmpresaNumero,
              bairro: businessRules.enderecoEmpresaBairro,
              cidade: businessRules.enderecoEmpresaCidade,
              estado: businessRules.enderecoEmpresaEstado
            };
          }
        }

        preparedResponsibles.push({
          info: responsible,
          baseAddress,
          diasTrabalho
        });
      }

      console.log(`✅ [FIND-DATE] Preparação de metadados concluída. Iniciando busca Lazy...`);

      // 2. FASE DE BUSCA: Cronológica (Dia 1 -> Dia 100)
      // 🆕 Retorna 10 DIAS ÚNICOS, escolhendo o melhor responsável (menor distância) por dia.
      const addedDays = new Set<string>();

      for (let daysAhead = 0; daysAhead < maxDaysAhead; daysAhead++) {
        if (addedDays.size >= 10) break;

        const candidateDate = new Date(searchStartDate);
        candidateDate.setDate(searchStartDate.getDate() + daysAhead);
        candidateDate.setHours(0, 0, 0, 0);

        const dateKey = candidateDate.toISOString().split('T')[0];
        const dayOfWeek = candidateDate.getDay();
        const currentDayName = dayNames[dayOfWeek];

        stats.checkedDays++;

        // 📋 LOG: Início da verificação do dia
        console.log(`\n📅 [VERIFICANDO DIA] ${dateKey} (${currentDayName})`);

        // Coletar TODOS os candidatos válidos para este dia
        const dayCandidates: Array<{
          responsible: typeof preparedResponsibles[0]['info'];
          distance: number;
          distanceType: 'between_points' | 'from_base';
          availableMinutes: number;
          totalMinutes: number;
          usedMinutes: number;
        }> = [];

        // 🔒 [PLAN-LIMITS] Limitar responsáveis por dia (apenas se não escolheu específico)
        let responsiblesForDay = preparedResponsibles;
        if (!specificResponsibleSelected && preparedResponsibles.length > planLimits.maxFindDateResponsiblesPerDay) {
          // Ordenar por disponibilidade (quem tem mais tempo livre primeiro) - critério simples
          // Nota: Poderia ordenar por proximidade da base, mas requer geocodificação extra
          responsiblesForDay = preparedResponsibles.slice(0, planLimits.maxFindDateResponsiblesPerDay);
          console.log(`  🔒 [LIMITE] Avaliando apenas ${responsiblesForDay.length}/${preparedResponsibles.length} responsáveis (limite do plano ${userPlan})`);
        }

        // 🔒 [PLAN-LIMITS] Verificar se ainda está dentro do limite de dias com OSRM
        const useOsrmForDistance = daysAhead < planLimits.maxFindDateOsrmDays;
        if (!useOsrmForDistance && daysAhead === planLimits.maxFindDateOsrmDays) {
          console.log(`\n⚠️ [PLAN-LIMITS] Limite de ${planLimits.maxFindDateOsrmDays} dias com OSRM atingido. Usando apenas Haversine a partir de agora.`);
        }

        // Iterar pelos responsáveis para este dia
        for (const data of responsiblesForDay) {
          const { info: responsible, baseAddress, diasTrabalho } = data;

          console.log(`  👤 [RESPONSÁVEL] ${responsible.name} (${responsible.type})`);

          // Verificar dia de trabalho
          if (!diasTrabalho.includes(currentDayName)) {
            console.log(`    ❌ [REJEITADO] Não trabalha em ${currentDayName}. Dias de trabalho: ${diasTrabalho.join(', ')}`);
            stats.skippedNotWorkDay++;
            continue;
          }

          console.log(`    ✓ Trabalha em ${currentDayName}`);

          // 🚀 JUST-IN-TIME AVAILABILITY UPDATE
          await updateDailyAvailability(userId, candidateDate, responsible.type, responsible.id, companyId);

          const availOwnerFilter = eq(dailyAvailability.companyId, companyId);
          const availability = await db.query.dailyAvailability.findFirst({
            where: and(
              availOwnerFilter,
              eq(dailyAvailability.responsibleType, responsible.type),
              eq(dailyAvailability.responsibleId, responsible.id),
              sql`DATE(${dailyAvailability.date}) = ${dateKey}`
            ),
          });

          if (!availability || availability.availableMinutes < service.duration) {
            const availMin = availability?.availableMinutes || 0;
            console.log(`    ❌ [REJEITADO] Sem tempo suficiente. Disponível: ${availMin}min / Necessário: ${service.duration}min`);
            stats.skippedNoTime++;
            continue;
          }

          console.log(`    ✓ Tempo disponível: ${availability.availableMinutes}min (necessário: ${service.duration}min)`);

          // --- LÓGICA DE DISTÂNCIA ---
          const startOfDay = new Date(candidateDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(candidateDate);
          endOfDay.setHours(23, 59, 59, 999);

          // Buscar agendamentos diretos
          const apptOwnerFilter = eq(appointments.companyId, companyId);
          let dayAppointments = await db.query.appointments.findMany({
            where: and(
              apptOwnerFilter,
              responsible.type === 'technician'
                ? eq(appointments.technicianId, responsible.id)
                : eq(appointments.teamId, responsible.id),
              sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
              sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
              sql`${appointments.status} != 'cancelled'`
            ),
          });

          // Se for técnico, incluir agendamentos das equipes
          if (responsible.type === 'technician') {
            const techTeams = await db.query.teamMembers.findMany({
              where: eq(teamMembers.technicianId, responsible.id)
            });
            for (const tm of techTeams) {
              const teamAppts = await db.query.appointments.findMany({
                where: and(
                  apptOwnerFilter,
                  eq(appointments.teamId, tm.teamId),
                  sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
                  sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`,
                  sql`${appointments.status} != 'cancelled'`
                ),
              });
              if (teamAppts.length > 0) {
                dayAppointments = [...dayAppointments, ...teamAppts];
              }
            }
          }

          let minDistance = Number.POSITIVE_INFINITY;
          let distanceType: 'between_points' | 'from_base' = 'from_base';

          // ========================================
          // 🆕 LÓGICA DE DISTÂNCIA COM OSRM
          // ========================================
          const targetCoords: Coords = { lat: targetLat, lng: targetLng };

          if (dayAppointments.length > 0) {
            // ========================================
            // CASO B: Dia COM paradas existentes
            // ========================================
            // 1. Construir array de coordenadas da rota atual (SEM base ainda)
            const routeCoords: Coords[] = [];
            const routeAddresses: string[] = [];

            for (const apt of dayAppointments) {
              if (!apt.clientId) continue;
              const aptClient = await db.query.clients.findFirst({ where: eq(clients.id, apt.clientId) });
              if (aptClient?.lat && aptClient?.lng) {
                routeCoords.push({ lat: aptClient.lat, lng: aptClient.lng });
                routeAddresses.push(`${aptClient.logradouro}, ${aptClient.numero} - ${aptClient.bairro || aptClient.cidade}`);
              }
            }

            if (routeCoords.length === 0) {
              console.log(`    ⚠️ [DISTANCE] Dia com agendamentos mas sem coordenadas válidas`);

              stats.skippedGeocodeError++;
              continue;
            }

            // 2. Obter coordenadas da BASE
            const cepBaseFormatado1 = formatCep(baseAddress.cep);
            const baseFullAddress = `${baseAddress.logradouro}, ${baseAddress.numero}, ${baseAddress.cidade}, ${cepBaseFormatado1}, Brasil`;
            let baseCoords: Coords;

            try {
              const geocoded = await geocodeWithNominatim(baseFullAddress);
              baseCoords = { lat: geocoded.lat, lng: geocoded.lng };
            } catch (error: any) {
              console.log(`    ⚠️ [GEOCODE] Erro ao geocodificar base: ${error.message}`);
              stats.skippedGeocodeError++;
              continue;
            }

            // 3. OTIMIZAR a ordem da rota (nearest neighbor a partir da base)
            console.log(`    🔄 [OTIMIZANDO] Ordenando rota por proximidade da base...`);
            const optimizedCoords: Coords[] = [];
            const optimizedAddresses: string[] = [];
            const remaining = [...routeCoords.map((coord, i) => ({ coord, addr: routeAddresses[i] }))];

            let currentPos = baseCoords;
            while (remaining.length > 0) {
              // Encontrar o ponto mais próximo do atual
              let nearestIdx = 0;
              let nearestDist = osrmHaversineDistance(currentPos.lat, currentPos.lng, remaining[0].coord.lat, remaining[0].coord.lng);

              for (let i = 1; i < remaining.length; i++) {
                const dist = osrmHaversineDistance(currentPos.lat, currentPos.lng, remaining[i].coord.lat, remaining[i].coord.lng);
                if (dist < nearestDist) {
                  nearestDist = dist;
                  nearestIdx = i;
                }
              }

              const nearest = remaining.splice(nearestIdx, 1)[0];
              optimizedCoords.push(nearest.coord);
              optimizedAddresses.push(nearest.addr);
              currentPos = nearest.coord;
            }

            // 4. Adicionar BASE no início da rota otimizada
            const fullRouteCoords = [baseCoords, ...optimizedCoords];
            const fullRouteAddresses = [
              `BASE: ${baseAddress.logradouro}, ${baseAddress.numero} - ${baseAddress.bairro || baseAddress.cidade}`,
              ...optimizedAddresses
            ];

            // 📍 LOG: Mostrar rota otimizada com base
            console.log(`    📍 [ROTA OTIMIZADA] ${fullRouteAddresses.length} pontos (incluindo base):`);
            fullRouteAddresses.forEach((addr, i) => console.log(`       ${i}. ${addr}`));
            console.log(`    📍 [NOVO PONTO] ${logradouro}, ${numero} - ${cidade}`);

            // 5. PRÉ-FILTRO HAVERSINE: Calcular distância Haversine até cada ponto da rota
            console.log(`    📏 [PRÉ-FILTRO] Calculando Haversine até cada ponto da rota...`);
            let minHaversineDist = Number.POSITIVE_INFINITY;

            for (let i = 0; i < fullRouteCoords.length; i++) {
              const dist = osrmHaversineDistance(
                fullRouteCoords[i].lat,
                fullRouteCoords[i].lng,
                targetLat,
                targetLng
              );
              console.log(`       📐 Haversine até ponto ${i}: ${dist.toFixed(1)}km`);
              if (dist < minHaversineDist) {
                minHaversineDist = dist;
              }
            }

            console.log(`    📏 [PRÉ-FILTRO] Menor Haversine: ${minHaversineDist.toFixed(1)}km (limite: ${maxDistanceHaversine}km)`);

            if (minHaversineDist > maxDistanceHaversine) {
              console.log(`    ❌ [REJEITADO] Pré-filtro Haversine: ${minHaversineDist.toFixed(1)}km > ${maxDistanceHaversine}km`);
              stats.skippedHaversinePreFilter++;
              continue;
            }

            console.log(`    ✅ [PRÉ-FILTRO] Passou! Continuando para cálculo OSRM...`);

            // 6. Calcular delta de inserção com OSRM usando rota completa (com base)
            // 🔒 [PLAN-LIMITS] Só usar OSRM se dentro do limite de dias
            if (useOsrmForDistance) {
              console.log(`    📎 [OSRM] Calculando delta de inserção na rota otimizada...`);
              const { deltaDistance } = await calculateInsertionDelta(fullRouteCoords, targetCoords);
              console.log(`    📎 [OSRM] Delta de inserção: ${deltaDistance.toFixed(1)}km (limite: ${maxDistanceOsrm}km)`);

              if (deltaDistance > maxDistanceOsrm) {
                console.log(`    ❌ [REJEITADO] Delta OSRM: ${deltaDistance.toFixed(1)}km > ${maxDistanceOsrm}km`);
                stats.skippedOsrmTooFar++;
                continue;
              }

              minDistance = deltaDistance;
              distanceType = 'between_points';
              console.log(`    ✅ [APROVADO] Delta OSRM: ${deltaDistance.toFixed(2)}km`);
            } else {
              // 🔒 [PLAN-LIMITS] Haversine-only mode (após limite de dias OSRM)
              console.log(`    📞 [HAVERSINE-ONLY] Usando Haversine como distância (limite OSRM atingido)`);

              // Usar a menor distância Haversine já calculada
              if (minHaversineDist > maxDistanceHaversine * 1.25) {
                // Rejeitar se muito distante (margem de 25% sobre o pré-filtro)
                console.log(`    ❌ [REJEITADO] Haversine: ${minHaversineDist.toFixed(1)}km > ${(maxDistanceHaversine * 1.25).toFixed(1)}km`);
                stats.skippedHaversinePreFilter++;
                continue;
              }

              minDistance = minHaversineDist;
              distanceType = 'between_points';
              console.log(`    ✅ [APROVADO] Haversine: ${minHaversineDist.toFixed(2)}km`);
            }

          } else {
            // ========================================
            // CASO A: Dia VAZIO (sem paradas)
            // ========================================
            // Usar distanciaMaximaAtendida (distância base → primeiro atendimento)

            const cepBaseFormatado2 = formatCep(baseAddress.cep);
            const baseFullAddress = `${baseAddress.logradouro}, ${baseAddress.numero}, ${baseAddress.cidade}, ${cepBaseFormatado2}, Brasil`;
            try {
              const baseCoords = await geocodeWithNominatim(baseFullAddress);
              const baseCoordsTyped: Coords = { lat: baseCoords.lat, lng: baseCoords.lng };

              // 1. Pré-filtro Haversine (usando 75% de maxDistanceServed como threshold)
              const haversineThreshold = maxDistanceServed * 0.75;
              const haversineDist = osrmHaversineDistance(baseCoords.lat, baseCoords.lng, targetLat, targetLng);

              console.log(`    📏 [DIA VAZIO] Haversine da base: ${haversineDist.toFixed(1)}km (limite pré-filtro: ${haversineThreshold.toFixed(1)}km)`);

              if (haversineDist > haversineThreshold) {
                console.log(`    ❌ [REJEITADO] Pré-filtro base: ${haversineDist.toFixed(1)}km > ${haversineThreshold.toFixed(1)}km`);
                stats.skippedHaversinePreFilter++;
                continue;
              }

              // 2. Validação com OSRM
              // 🔒 [PLAN-LIMITS] Só usar OSRM se dentro do limite de dias
              if (useOsrmForDistance) {
                const osrmDist = await calculateOSRMDistance(baseCoordsTyped, targetCoords);

                console.log(`    📎 [DIA VAZIO] OSRM da base: ${osrmDist.toFixed(1)}km (limite: ${maxDistanceServed}km)`);

                if (osrmDist > maxDistanceServed) {
                  console.log(`    ❌ [REJEITADO] Distância base OSRM: ${osrmDist.toFixed(1)}km > ${maxDistanceServed}km`);
                  stats.skippedOsrmTooFar++;
                  continue;
                }

                minDistance = osrmDist;
                distanceType = 'from_base';
                console.log(`    ✅ [APROVADO] Distância da base: ${osrmDist.toFixed(2)}km`);
              } else {
                // 🔒 [PLAN-LIMITS] Haversine-only mode (após limite de dias OSRM)
                console.log(`    📞 [HAVERSINE-ONLY] Usando Haversine como distância (limite OSRM atingido)`);

                if (haversineDist > maxDistanceServed) {
                  console.log(`    ❌ [REJEITADO] Haversine base: ${haversineDist.toFixed(1)}km > ${maxDistanceServed}km`);
                  stats.skippedHaversinePreFilter++;
                  continue;
                }

                minDistance = haversineDist;
                distanceType = 'from_base';
                console.log(`    ✅ [APROVADO] Haversine da base: ${haversineDist.toFixed(2)}km`);
              }

            } catch (error: any) {
              console.log(`    ⚠️ [GEOCODE] Erro ao geocodificar base: ${error.message}`);
              stats.skippedGeocodeError++;
              continue;
            }
          }

          // Adicionar à lista de candidatos do dia
          dayCandidates.push({
            responsible,
            distance: minDistance,
            distanceType,
            availableMinutes: availability.availableMinutes,
            totalMinutes: availability.totalMinutes,
            usedMinutes: availability.usedMinutes
          });
        }

        // Se encontramos candidatos para este dia, escolher o MELHOR (menor distância)
        if (dayCandidates.length > 0) {
          // Ordenar por distância (menor primeiro)
          dayCandidates.sort((a, b) => a.distance - b.distance);
          const best = dayCandidates[0];

          const candidate = {
            date: dateKey,
            responsibleType: best.responsible.type,
            responsibleId: best.responsible.id,
            responsibleName: best.responsible.name,
            availableMinutes: best.availableMinutes,
            totalMinutes: best.totalMinutes,
            usedMinutes: best.usedMinutes,
            distance: best.distance,
            distanceType: best.distanceType,
          };

          console.log(`  ✨ CANDIDATO ADICIONADO: ${dateKey} - ${best.responsible.name} (${best.distance.toFixed(2)}km)`);
          candidates.push(candidate);
          addedDays.add(dateKey);
          res.write(`data: ${JSON.stringify(candidate)}\n\n`);
          
          // 🚀 PERFORMANCE: Parar imediatamente após 10 resultados
          if (addedDays.size >= 10) {
            console.log(`\n🎯 [FIND-DATE] Limite de 10 datas atingido. Parando busca.`);
            break;
          }
        } else {
          console.log(`  ❌ [DIA DESCARTADO] ${dateKey} - Nenhum responsável atende aos critérios`);
        }
      }

      // 🛑 CÓDIGO ANTIGO REMOVIDO (era desativado com if (false))

      // Resumo final acumulado
      const responsiblesChecked = responsibles.length;
      console.log(`\n📊 [FIND-DATE] Resumo Final (${responsiblesChecked} prestadores analisados):`);
      console.log(`  - Dias verificados: ${stats.checkedDays}`);
      console.log(`  - Rejeitados (não é dia de trabalho): ${stats.skippedNotWorkDay}`);
      console.log(`  - Rejeitados (sem tempo livre): ${stats.skippedNoTime}`);
      console.log(`  - Rejeitados (pré-filtro Haversine): ${stats.skippedHaversinePreFilter}`);
      console.log(`  - Rejeitados (OSRM distância real): ${stats.skippedOsrmTooFar}`);
      console.log(`  - Erros geocodificação: ${stats.skippedGeocodeError}`);
      console.log(`  - ✅ Candidatos encontrados: ${candidates.length}`);
      console.log(`\n🌐 [OSRM] Estatísticas de chamadas:`);
      console.log(`  - Chamadas bem-sucedidas: ${osrmStats.callsSuccess}`);
      console.log(`  - Hits de cache: ${osrmStats.callsCached}`);
      console.log(`  - Fallbacks (erro): ${osrmStats.callsFailed}`);

      console.log(`\n🎯 [FIND-DATE] Busca concluída! ${candidates.length} opções encontradas`);

      // 📊 Tracking de métricas
      trackFeatureUsage(req.user.userId, "find_date", "search", req.user.companyId, {
        serviceId,
        candidatesFound: candidates.length,
        daysSearched: stats.checkedDays,
      });

      // 🌊 Enviar evento de conclusão
      res.write('data: {"done": true}\n\n');
      res.end();
    } catch (error: any) {
      console.error("❌ [FIND-DATE] Erro:", error);
      if (res.headersSent) {
        res.write(`data: {"error": "${error.message || 'Erro ao buscar datas disponíveis'}"}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: error.message || 'Erro ao buscar datas disponíveis' });
      }
    }
  });

  app.put("/api/appointments/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const appointmentData = req.body;

      console.log(`🔧 [UPDATE] Atualizando agendamento ${id}:`, appointmentData);

      // 🔒 VALIDAÇÃO: Só permite edição de agendamentos com status 'scheduled' ou 'rescheduled'
      const existingAppointment = await storage.getAppointment(id, req.user.companyId);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      const editableStatuses = ['scheduled', 'rescheduled'];
      if (!editableStatuses.includes(existingAppointment.status)) {
        return res.status(400).json({
          message: `Não é possível editar agendamentos com status "${existingAppointment.status}". Apenas agendamentos com status "Agendado" ou "Remarcado" podem ser editados.`
        });
      }

      // Corrigir campo scheduledDate se presente
      if (appointmentData.scheduledDate) {

        console.log(`📅 [UPDATE] Data recebida (tipo: ${typeof appointmentData.scheduledDate}):`, appointmentData.scheduledDate);

        // Se já é uma string ISO, manter como está
        if (typeof appointmentData.scheduledDate === 'string') {
          console.log(`✅ [UPDATE] Data já é string, mantendo: ${appointmentData.scheduledDate}`);
        }
        // Se é um objeto Date, converter para ISO string
        else if (appointmentData.scheduledDate instanceof Date) {
          appointmentData.scheduledDate = appointmentData.scheduledDate.toISOString();
          console.log(`🔄 [UPDATE] Data convertida para ISO: ${appointmentData.scheduledDate}`);
        }
        // Se é outro tipo, tentar criar Date primeiro
        else {
          try {
            const dateObj = new Date(appointmentData.scheduledDate);
            if (isNaN(dateObj.getTime())) {
              throw new Error(`Data inválida: ${appointmentData.scheduledDate}`);
            }
            appointmentData.scheduledDate = dateObj.toISOString();
            console.log(`🔄 [UPDATE] Data parseada e convertida: ${appointmentData.scheduledDate}`);
          } catch (dateError) {
            console.log(`❌ [UPDATE] Erro ao processar data:`, dateError);
            return res.status(400).json({ message: `Data inválida: ${appointmentData.scheduledDate}` });
          }
        }
      }

      // Buscar agendamento original para rastrear mudanças
      const originalAppointment = await storage.getAppointment(id, req.user.companyId);

      const appointment = await storage.updateAppointment(id, appointmentData, req.user.companyId);
      console.log(`✅ [UPDATE] Agendamento atualizado com sucesso: ${appointment.id}`);

      // Criar descrição detalhada das mudanças
      const changes: string[] = [];
      let changeType = 'status_changed';

      if (originalAppointment && appointmentData.scheduledDate) {
        const oldDate = new Date(originalAppointment.scheduledDate);
        const newDate = new Date(appointmentData.scheduledDate);
        if (oldDate.toDateString() !== newDate.toDateString()) {
          changes.push(`data de ${oldDate.toLocaleDateString('pt-BR')} para ${newDate.toLocaleDateString('pt-BR')}`);
          changeType = 'rescheduled';
          // Increment reschedule count
          appointmentData.rescheduleCount = (originalAppointment.rescheduleCount || 0) + 1;
        }
      }

      if (originalAppointment && appointmentData.technicianId !== undefined && originalAppointment.technicianId !== appointmentData.technicianId) {
        changes.push('técnico alterado');
        changeType = 'provider_updated';
      }

      if (originalAppointment && appointmentData.teamId !== undefined && originalAppointment.teamId !== appointmentData.teamId) {
        changes.push('equipe alterada');
        changeType = 'provider_updated';
      }

      const description = changes.length > 0
        ? `Alterou ${changes.join(', ')} do agendamento #${appointment.id}`
        : `Atualizou agendamento #${appointment.id}`;

      // 📝 Registrar no histórico do agendamento
      if (originalAppointment) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, req.user.userId),
        });

        const changedByName = user?.name || user?.username || 'Usuário';

        await db.insert(appointmentHistory).values({
          appointmentId: id,
          userId: req.user.userId, // Campo obrigatório
          companyId: req.user.companyId, // 🔒 Multi-tenant obrigatório
          changedBy: req.user.userId,
          changedByName,
          changeType,
          previousData: JSON.stringify({
            scheduledDate: originalAppointment.scheduledDate,
            technicianId: originalAppointment.technicianId,
            teamId: originalAppointment.teamId,
            status: originalAppointment.status,
          }),
          newData: JSON.stringify({
            scheduledDate: appointment.scheduledDate,
            technicianId: appointment.technicianId,
            teamId: appointment.teamId,
            status: appointment.status,
          }),
          reason: changes.length > 0 ? `Manual: ${changes.join(', ')}` : 'Atualização manual',
        });
      }

      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "appointments",
        action: "update",
        resourceId: appointment.id,
        description,
        metadata: { changes: appointmentData }
      });
      res.json(appointment);
    } catch (error: any) {
      console.log(`❌ [UPDATE] Erro ao atualizar agendamento:`, error.message);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/appointments/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    /* console.log(`==== LOG INÍCIO: PATCH /api/appointments/${req.params.id} ====`); */
    /* console.log("Dados recebidos:"); */
    /* console.log(JSON.stringify(req.body, null, 2)); */

    try {
      const id = parseInt(req.params.id);
      const appointmentData = req.body;

      // (repete o tratamento do campo scheduledDate, igual ao PUT)
      if (appointmentData.scheduledDate) {
        console.log(`📅 [PATCH] Data recebida: ${appointmentData.scheduledDate}`);
        if (typeof appointmentData.scheduledDate === 'string') {
          console.log("✅ [PATCH] Data já é string");
        } else if (appointmentData.scheduledDate instanceof Date) {
          appointmentData.scheduledDate = appointmentData.scheduledDate.toISOString();
          console.log(`🔄 [PATCH] Data convertida: ${appointmentData.scheduledDate}`);
        } else {
          try {
            const dateObj = new Date(appointmentData.scheduledDate);
            if (isNaN(dateObj.getTime())) {
              throw new Error(`Data inválida: ${appointmentData.scheduledDate}`);
            }
            appointmentData.scheduledDate = dateObj.toISOString();
            console.log(`🔄 [PATCH] Data parseada: ${appointmentData.scheduledDate}`);
          } catch (dateError: any) {
            console.log(`❌ [PATCH] Erro ao processar data:`, dateError);
            /* console.log("==== LOG FIM: PATCH /api/appointments (ERRO DATA) ===="); */
            return res.status(400).json({ message: `Data inválida: ${appointmentData.scheduledDate}` });
          }
        }
      }

      // Buscar agendamento original para validação
      const originalAppointment = await storage.getAppointment(id, req.user.companyId);
      if (!originalAppointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Se mudou técnico/equipe ou data, validar conflito
      const technicianChanged = appointmentData.technicianId !== undefined &&
        appointmentData.technicianId !== originalAppointment.technicianId;
      const teamChanged = appointmentData.teamId !== undefined &&
        appointmentData.teamId !== originalAppointment.teamId;
      const dateChanged = appointmentData.scheduledDate &&
        new Date(appointmentData.scheduledDate).toDateString() !==
        new Date(originalAppointment.scheduledDate).toDateString();

      if (technicianChanged || teamChanged || dateChanged) {
        const validation = await validateTechnicianTeamConflict(
          req.user.userId,
          new Date(appointmentData.scheduledDate || originalAppointment.scheduledDate),
          appointmentData.technicianId !== undefined ? appointmentData.technicianId : originalAppointment.technicianId,
          appointmentData.teamId !== undefined ? appointmentData.teamId : originalAppointment.teamId,
          id, // Excluir o próprio agendamento da validação
          req.user.companyId
        );

        if (!validation.valid) {
          return res.status(400).json({ message: validation.message });
        }

        // Validar horário de trabalho (dias e horários)
        const workScheduleValidation = await validateWorkSchedule(
          storage,
          req.user.userId,
          new Date(appointmentData.scheduledDate || originalAppointment.scheduledDate),
          appointmentData.technicianId !== undefined ? appointmentData.technicianId : originalAppointment.technicianId,
          appointmentData.teamId !== undefined ? appointmentData.teamId : originalAppointment.teamId,
          req.user.companyId
        );

        if (!workScheduleValidation.valid) {
          return res.status(400).json({ message: workScheduleValidation.message });
        }
      }

      // ⚠️ Se a data mudou, salvar histórico ANTES de limpar dados
      // Isso preserva fotos, assinaturas e status do romaneio antigo para auditoria
      if (dateChanged) {
        console.log(`📸 [PATCH] Salvando histórico do agendamento ${id} antes de remarcar`);

        // Salvar estado atual no histórico
        await db.insert(appointmentHistory).values({
          appointmentId: id,
          changedBy: req.user.userId,
          changedByName: req.user.name || req.user.username,
          changeType: 'rescheduled',
          previousData: originalAppointment, // Estado completo com fotos, assinatura, etc.
          newData: { ...originalAppointment, ...appointmentData }, // Novo estado
          reason: 'Agendamento remarcado para outra data',
          userId: req.user.userId,
          companyId: req.user.companyId,
        });

        console.log(`🧹 [PATCH] Limpando dados de execução do agendamento ${id} devido à remarcação`);
        appointmentData.executionStatus = null;
        appointmentData.executionNotes = null;
        appointmentData.executionStartedAt = null;
        appointmentData.executionFinishedAt = null;
        appointmentData.photos = null;
        appointmentData.signature = null;
        if (originalAppointment.status !== 'scheduled') {
          appointmentData.status = 'scheduled';
        }

        // Increment reschedule count
        appointmentData.rescheduleCount = (originalAppointment.rescheduleCount || 0) + 1;
      }

      const appointment = await storage.updateAppointment(id, appointmentData, req.user.companyId);

      // Atualizar disponibilidade da data antiga se mudou a data
      if (dateChanged) {
        const oldDate = new Date(originalAppointment.scheduledDate);
        if (originalAppointment.technicianId) {
          await updateAvailabilityForAppointment(req.user.userId, { ...originalAppointment, scheduledDate: oldDate } as any, req.user.companyId);
        }
        if (originalAppointment.teamId) {
          await updateAvailabilityForAppointment(req.user.userId, { ...originalAppointment, scheduledDate: oldDate } as any, req.user.companyId);
        }
      }

      // Atualizar disponibilidade da nova data/responsável
      await updateAvailabilityForAppointment(req.user.userId, appointment, req.user.companyId);

      console.log(`✅ [PATCH] Agendamento ${id} atualizado com sucesso`);
      console.log("==== LOG FIM: PATCH /api/appointments (SUCESSO) ====");

      // Criar descrição detalhada das mudanças
      const changes: string[] = [];
      if (originalAppointment && appointmentData.scheduledDate) {
        const oldDate = new Date(originalAppointment.scheduledDate);
        const newDate = new Date(appointmentData.scheduledDate);
        if (oldDate.toDateString() !== newDate.toDateString()) {
          changes.push(`data de ${oldDate.toLocaleDateString('pt-BR')} para ${newDate.toLocaleDateString('pt-BR')}`);
        }
      }

      const description = changes.length > 0
        ? `Alterou ${changes.join(', ')} do agendamento #${appointment.id}`
        : `Atualizou agendamento #${appointment.id}`;

      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "appointments",
        action: "update",
        resourceId: appointment.id,
        description,
        metadata: { changes: appointmentData }
      });

      res.json(appointment);
    } catch (error: any) {
      console.log(`❌ [PATCH] Erro ao atualizar agendamento ${req.params.id}:`);
      console.log("Tipo do erro:", error.constructor.name);
      console.log("Mensagem:", error.message);
      console.log("==== LOG FIM: PATCH /api/appointments (ERRO) ====");

      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/appointments/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    console.log(`==== LOG INÍCIO: DELETE /api/appointments/${req.params.id} ====`);

    try {
      const id = parseInt(req.params.id);
      console.log(`🗑️ Tentando deletar agendamento ID: ${id}`);

      // Buscar agendamento antes de deletar para atualizar disponibilidade
      const appointmentToDelete = await storage.getAppointment(id, req.user.companyId);

      const success = await storage.deleteAppointment(id, req.user.companyId);
      if (!success) {
        console.log(`❌ Agendamento ${id} não encontrado para o usuário`);
        console.log("==== LOG FIM: DELETE /api/appointments (NÃO ENCONTRADO) ====");
        return res.status(404).json({ message: "Appointment not found" });
      }

      // Atualizar disponibilidade após deletar
      if (appointmentToDelete) {
        await updateAvailabilityForAppointment(req.user.userId, appointmentToDelete, req.user.companyId);
      }

      console.log(`✅ Agendamento ${id} deletado com sucesso`);
      console.log("==== LOG FIM: DELETE /api/appointments (SUCESSO) ====");

      res.json({ message: "Appointment deleted successfully" });
    } catch (error: any) {
      console.log(`❌ Erro ao deletar agendamento ${req.params.id}:`);
      console.log("Tipo do erro:", error.constructor.name);
      console.log("Mensagem:", error.message);
      console.log("==== LOG FIM: DELETE /api/appointments (ERRO) ====");

      res.status(500).json({ message: error.message });
    }
  });

  // Geocodificar e salvar coordenadas de appointments que não têm lat/lng
  // Body: { appointmentIds: number[] }
  // Retorno: { updatedIds: number[], failed: Array<{id:number, error:string}> }
  app.post("/api/appointments/geocode-missing", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const ids = (req.body?.appointmentIds ?? []).filter((x: any) => Number.isFinite(x));
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "appointmentIds vazio" });
      }

      // Pega TODOS os appointments do usuário e filtra pelos IDs informados
      // (usamos storage para manter o padrão do projeto)
      const all = await storage.getAppointments(req.user.companyId);
      const rows = all.filter((a: any) => ids.includes(a.id));

      const updatedIds: number[] = [];
      const failed: Array<{ id: number; error: string }> = [];

      // Processa em série para respeitar o rate-limit do Nominatim
      for (const a of rows) {
        // Pula se não há clientId válido
        if (!a.clientId) continue;

        // Verifica se o cliente já tem coordenadas (lat/lng estão na tabela clients)
        const client = await db.select().from(clients).where(eq(clients.id, a.clientId)).limit(1);
        const hasCoords = client[0] && Number.isFinite(client[0].lat) && Number.isFinite(client[0].lng);
        if (hasCoords) continue;

        const fullAddress = composeFullAddressFromAppointment(a);
        console.log("📍 [GEO] Geocodificando:", a.id, "=>", fullAddress);

        try {
          const { lat, lng } = await geocodeWithNominatim(fullAddress);

          // Atualiza as coordenadas no cliente, não no appointment
          await db.update(clients).set({ lat, lng }).where(eq(clients.id, a.clientId));
          updatedIds.push(a.id);

          // pequena pausa para evitar 429
          await sleep(700);
        } catch (err: any) {
          console.error("❌ [GEO] Falha ao geocodificar", a.id, err?.message);
          failed.push({ id: a.id, error: err?.message ?? "erro desconhecido" });
          await sleep(400);
        }
      }

      return res.json({ updatedIds, failed });
    } catch (e: any) {
      console.error("❌ [/api/appointments/geocode-missing] Erro:", e?.message);
      return res.status(500).json({ error: "Falha ao geocodificar agendamentos" });
    }
  });

  // ==============================================
  // PENDING RESOLUTIONS - Sistema de Resolução de Pendências
  // ==============================================

  // POST /api/pending-resolutions/resolve - Resolver uma pendênc ia
  app.post("/api/pending-resolutions/resolve", authenticateToken, async (req: any, res) => {
    try {
      const {
        appointmentId,
        resolutionAction,
        originalPendingReason,
        newScheduledDate,
        newScheduledTime,
        newTechnicianId,
        newTeamId,
        cancellationReason,
        providerResolutionDetails,
        followUpDate,
        followUpResponsible,
        addressCorrected,
        clientAddress,
        contactedClient,
        contactChannel,
        contactDate,
        resolutionNotes,
      } = req.body;

      console.log(`🔧 [RESOLVE-PENDING] Iniciando resolução de pendência para agendamento #${appointmentId}`);
      console.log(`   Ação: ${resolutionAction}, Motivo original: ${originalPendingReason}`);
      console.log(`   Body recebido:`, JSON.stringify(req.body, null, 2));

      // Validações básicas
      const missingFields = [];
      if (!appointmentId) missingFields.push('appointmentId');
      if (!resolutionAction) missingFields.push('resolutionAction');
      if (!originalPendingReason) missingFields.push('originalPendingReason');

      if (missingFields.length > 0) {
        console.log(`❌ [RESOLVE-PENDING] Campos faltando: ${missingFields.join(', ')}`);
        return res.status(400).json({ message: `Dados obrigatórios faltando: ${missingFields.join(', ')}` });
      }

      // Buscar agendamento
      const apptOwnerFilter = eq(appointments.companyId, req.user.companyId);
      const appointment = await db.query.appointments.findFirst({
        where: and(
          eq(appointments.id, appointmentId),
          apptOwnerFilter
        ),
      });

      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Snapshot do estado anterior (para auditoria)
      const previousData = { ...appointment };

      // 🔒 VALIDAÇÃO: Se motivo = "endereco_incorreto" e ação = "rescheduled", endereço DEVE ser corrigido
      if (originalPendingReason === 'endereco_incorreto' && resolutionAction === 'rescheduled') {
        if (!addressCorrected || !clientAddress) {
          return res.status(400).json({
            message: "É obrigatório corrigir o endereço antes de reagendar quando o motivo é 'Endereço incorreto'"
          });
        }
      }

      let newData: any = {};
      let changeType = '';
      let reason = '';

      // === PROCESSAR CADA TIPO DE AÇÃO ===


      if (resolutionAction === 'rescheduled') {
        // REAGENDAR
        if (!newScheduledDate) {
          return res.status(400).json({ message: "Nova data é obrigatória para reagendar" });
        }

        const newDateTime = new Date(`${newScheduledDate}T${newScheduledTime || '00:00'}:00`);

        // 🔧 IMPORTANTE: Remover o agendamento da rota antiga
        // Isso faz o agendamento aparecer como "Sem romaneio" e remove da lista de pendências
        await db.delete(routeStops)
          .where(eq(routeStops.appointmentNumericId, appointmentId));

        console.log(`🗑️ [RESOLVE-PENDING] Agendamento removido da rota antiga`);

        // Atualizar agendamento - usa status 'rescheduled' para diferenciar de novo agendamento
        await db.update(appointments)
          .set({
            scheduledDate: newDateTime,
            status: 'rescheduled', // 🔧 CORREÇÃO: Usar 'rescheduled' para rastreabilidade
            executionStatus: null, // Limpa o status de execução anterior
            rescheduleCount: (appointment.rescheduleCount || 0) + 1, // Incrementa contador de reagendamentos
            notes: resolutionNotes
              ? (appointment.notes ? `${appointment.notes}\n[Reagendamento]: ${resolutionNotes}` : `[Reagendamento]: ${resolutionNotes}`)
              : appointment.notes, // Preserva ou adiciona a nova nota
            ...(newTechnicianId !== undefined && { technicianId: newTechnicianId || null }),
            ...(newTeamId !== undefined && { teamId: newTeamId || null }),
          })
          .where(eq(appointments.id, appointmentId));


        // Se endereço foi corrigido, atualizar cliente
        if (addressCorrected && clientAddress && appointment.clientId) {
          await db.update(clients)
            .set({
              ...(clientAddress.cep && { cep: clientAddress.cep }),
              ...(clientAddress.logradouro && { logradouro: clientAddress.logradouro }),
              ...(clientAddress.numero && { numero: clientAddress.numero }),
              ...(clientAddress.complemento !== undefined && { complemento: clientAddress.complemento }),
              ...(clientAddress.bairro && { bairro: clientAddress.bairro }),
              ...(clientAddress.cidade && { cidade: clientAddress.cidade }),
              ...(clientAddress.estado && { estado: clientAddress.estado }),
            })
            .where(eq(clients.id, appointment.clientId));
        }

        newData = {
          scheduledDate: newDateTime,
          status: 'scheduled',
          executionStatus: null,
          technicianId: newTechnicianId || appointment.technicianId,
          teamId: newTeamId || appointment.teamId,
        };
        changeType = 'rescheduled';
        reason = `Reagendado de ${appointment.scheduledDate.toLocaleString('pt-BR')} para ${newDateTime.toLocaleString('pt-BR')}`;

        if (addressCorrected) {
          reason += ' (endereço corrigido)';
        }

        console.log(`✅ [RESOLVE-PENDING] Agendamento reagendado para ${newDateTime.toISOString()}`);


      } else if (resolutionAction === 'cancelled') {
        // CANCELAR
        if (!cancellationReason) {
          return res.status(400).json({ message: "Motivo do cancelamento é obrigatório" });
        }

        await db.update(appointments)
          .set({ status: 'cancelled' })
          .where(eq(appointments.id, appointmentId));

        newData = { status: 'cancelled' };
        changeType = 'cancelled';
        reason = `Cancelado: ${cancellationReason}`;

        console.log(`✅ [RESOLVE-PENDING] Agendamento cancelado`);

      } else if (resolutionAction === 'resolved_by_provider') {
        // RESOLVIDO PELO PRESTADOR - marca como concluído para sair da lista de pendências
        if (!providerResolutionDetails) {
          return res.status(400).json({ message: "Descrição da resolução é obrigatória" });
        }

        await db.update(appointments)
          .set({
            executionStatus: 'concluido', // Marca como concluído para sair da pendência
          })
          .where(eq(appointments.id, appointmentId));

        newData = {
          executionStatus: 'concluido'
        };
        changeType = 'status_changed';
        reason = `Resolvido pelo prestador: ${providerResolutionDetails}`;

        console.log(`✅ [RESOLVE-PENDING] Marcado como resolvido pelo prestador (concluído)`);

      } else if (resolutionAction === 'awaiting') {
        // AGUARDANDO RETORNO (não altera appointment, apenas registra a pendência)
        newData = {};
        changeType = 'status_changed';
        reason = `Aguardando retorno${followUpDate ? ` até ${new Date(followUpDate).toLocaleDateString('pt-BR')}` : ''}`;

        console.log(`✅ [RESOLVE-PENDING] Marcado como aguardando retorno`);

      } else if (resolutionAction === 'payment_confirmed') {
        // 💰 PAGAMENTO CONFIRMADO - marca pagamento como recebido
        await db.update(appointments)
          .set({
            paymentStatus: 'pago',
            paymentConfirmedAt: nowInSaoPaulo(),
            // Manter executionStatus como 'concluido' - não alterar
          })
          .where(eq(appointments.id, appointmentId));

        newData = {
          paymentStatus: 'pago',
          paymentConfirmedAt: nowInSaoPaulo(),
        };
        changeType = 'payment_confirmed';
        reason = resolutionNotes || 'Pagamento confirmado pelo gestor';

        console.log(`✅ [RESOLVE-PENDING] Pagamento confirmado`);
      }

      // Buscar nome do usuário para o histórico
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user.userId),
      });

      const changedByName = user?.name || user?.username || 'Usuário';

      // Criar registro de resolução de pendência
      const [resolutionRecord] = await db.insert(pendingResolutions).values({
        appointmentId,
        originalPendingReason,
        resolutionAction,
        contactedClient: contactedClient || false,
        contactChannel: contactChannel || null,
        contactDate: contactDate ? new Date(contactDate) : null,
        addressCorrected: addressCorrected || false,
        resolutionNotes: resolutionNotes || null,
        resolvedBy: req.user.userId,
        rescheduledFrom: resolutionAction === 'rescheduled' ? appointment.scheduledDate : null,
        rescheduledTo: resolutionAction === 'rescheduled' && newScheduledDate
          ? new Date(`${newScheduledDate}T${newScheduledTime || '00:00'}:00`)
          : null,
        cancellationReason: resolutionAction === 'cancelled' ? cancellationReason : null,
        providerResolutionDetails: resolutionAction === 'resolved_by_provider' ? providerResolutionDetails : null,
        awaitingFollowUpDate: resolutionAction === 'awaiting' && followUpDate ? new Date(followUpDate) : null,
        awaitingResponsible: resolutionAction === 'awaiting' && followUpResponsible ? followUpResponsible : null,
        userId: req.user.userId,
        companyId: req.user.companyId,
      }).returning();

      // Criar registro de histórico de agendamento
      await db.insert(appointmentHistory).values({
        appointmentId,
        changedBy: req.user.userId,
        changedByName,
        changeType,
        previousData: JSON.stringify(previousData),
        newData: JSON.stringify(newData),
        reason,
        notes: resolutionNotes || null,
        pendingResolutionId: resolutionRecord.id,
        userId: req.user.userId,
        companyId: req.user.companyId,
      });

      // Atualizar disponibilidade se reagendou
      if (resolutionAction === 'rescheduled' && newScheduledDate) {
        const updatedAppointment = await db.query.appointments.findFirst({
          where: eq(appointments.id, appointmentId),
        });
        if (updatedAppointment) {
          await updateAvailabilityForAppointment(req.user.userId, updatedAppointment, req.user.companyId);
        }
      }

      // Audit log
      trackCompanyAudit({
        userId: req.user.userId,
        companyId: req.user.companyId,
        feature: "pending_resolutions",
        action: "resolve",
        resourceId: appointmentId.toString(),
        description: `Resolveu pendência do agendamento #${appointmentId} com ação: ${resolutionAction}`,
        metadata: { resolutionAction, originalPendingReason }
      });

      console.log(`✅✅ [RESOLVE-PENDING] Resolução concluída com sucesso`);

      res.json({
        success: true,
        message: "Pendência resolvida com sucesso",
        resolutionId: resolutionRecord.id,
      });

    } catch (error: any) {
      console.error(`❌ [RESOLVE-PENDING] Erro ao resolver pendência:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/appointments/:id/history - Buscar histórico de um agendamento
  app.get("/api/appointments/:id/history", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);

      if (isNaN(appointmentId)) {
        return res.status(400).json({ message: "ID inválido" });
      }

      // Verificar se agendamento existe e pertence ao usuário
      const apptOwnerFilter = eq(appointments.companyId, req.user.companyId);
      const appointment = await db.query.appointments.findFirst({
        where: and(
          eq(appointments.id, appointmentId),
          apptOwnerFilter
        ),
      });

      if (!appointment) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }

      // Buscar histórico completo
      const history = await db.query.appointmentHistory.findMany({
        where: and(
          eq(appointmentHistory.appointmentId, appointmentId),
          eq(appointmentHistory.userId, req.user.userId)
        ),
        orderBy: (appointmentHistory, { desc }) => [desc(appointmentHistory.changedAt)],
      });

      // Buscar informações adicionais de resolução de pendências
      const historyWithDetails = await Promise.all(
        history.map(async (h) => {
          let resolutionDetails = null;
          if (h.pendingResolutionId) {
            const resolution = await db.query.pendingResolutions.findFirst({
              where: eq(pendingResolutions.id, h.pendingResolutionId),
            });
            if (resolution) {
              resolutionDetails = {
                action: resolution.resolutionAction,
                originalReason: resolution.originalPendingReason,
                contactedClient: resolution.contactedClient,
                contactChannel: resolution.contactChannel,
                notes: resolution.resolutionNotes,
              };
            }
          }

          return {
            ...h,
            resolutionDetails,
          };
        })
      );

      res.json(historyWithDetails);

    } catch (error: any) {
      console.error(`❌ [APPOINTMENT-HISTORY] Erro:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/pending-resolutions/stats - Estatísticas de pendências
  app.get("/api/pending-resolutions/stats", authenticateToken, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      let whereConditions = [eq(pendingResolutions.userId, req.user.userId)];

      if (startDate) {
        whereConditions.push(sql`${pendingResolutions.resolvedAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        whereConditions.push(sql`${pendingResolutions.resolvedAt} <= ${new Date(endDate as string)}`);
      }

      // Buscar todas as resoluções no período
      const resolutions = await db.query.pendingResolutions.findMany({
        where: and(...whereConditions),
      });

      // Calcular estatísticas
      const total = resolutions.length;
      const byReason: Record<string, number> = {};
      const byAction: Record<string, number> = {};
      const cancellationReasons: Record<string, number> = {};

      resolutions.forEach((r) => {
        // Por motivo original
        byReason[r.originalPendingReason] = (byReason[r.originalPendingReason] || 0) + 1;

        // Por ação de resolução
        byAction[r.resolutionAction] = (byAction[r.resolutionAction] || 0) + 1;

        // Motivos de cancelamento
        if (r.resolutionAction === 'cancelled' && r.cancellationReason) {
          cancellationReasons[r.cancellationReason] = (cancellationReasons[r.cancellationReason] || 0) + 1;
        }
      });

      // Calcular tempo médio de resolução (em horas)
      const resolutionTimes = resolutions
        .filter(r => r.resolvedAt && r.createdAt)
        .map(r => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60)); // em horas

      const avgResolutionTimeHours = resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

      // Formatar para percentagem
      const byReasonWithPercentage = Object.entries(byReason).map(([reason, count]) => ({
        reason,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }));

      const topCancellationReasons = Object.entries(cancellationReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      res.json({
        totalResolved: total,
        avgResolutionTimeHours: Math.round(avgResolutionTimeHours * 100) / 100,
        byReason: byReasonWithPercentage,
        byResolutionAction: {
          rescheduled: byAction.rescheduled || 0,
          cancelled: byAction.cancelled || 0,
          resolved_by_provider: byAction.resolved_by_provider || 0,
          awaiting: byAction.awaiting || 0,
        },
        topCancellationReasons,
      });

    } catch (error: any) {
      console.error(`❌ [PENDING-STATS] Erro:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  // Checklists routes
  app.post("/api/gerar-rota", authenticateToken, async (req: any, res) => {
    try {
      const { appointmentIds } = req.body;
      if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return res.status(400).json({ message: "Appointment IDs are required" });
      }

      const optimizedRoute = await storage.optimizeRoute(appointmentIds, req.user.companyId);
      res.json(optimizedRoute);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Checklists routes
  app.get("/api/checklists", authenticateToken, async (req: any, res) => {
    try {
      const checklists = await storage.getChecklists(req.user.companyId);
      res.json(checklists);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/checklists", authenticateToken, async (req: any, res) => {
    try {
      const checklistData = insertChecklistSchema.parse(req.body);
      const checklist = await storage.createChecklist(checklistData, req.user.userId, req.user.companyId);
      res.json(checklist);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/checklists/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const checklistData = insertChecklistSchema.partial().parse(req.body);
      const checklist = await storage.updateChecklist(id, checklistData, req.user.companyId);
      res.json(checklist);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/checklists/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteChecklist(id, req.user.companyId);
      if (!success) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json({ message: "Checklist deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Business Rules routes (prestador/tecnico precisam ler para tela de prestadores)
  // 🔒 administrativo incluído para permitir acesso à tela de Prestadores
  app.get("/api/business-rules", authenticateToken, requireRole(['admin', 'operador', 'prestador', 'tecnico', 'administrativo']), async (req: any, res) => {
    try {
      const businessRules = await storage.getBusinessRules(req.user.companyId);
      res.json(businessRules || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/business-rules", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const businessRulesData = insertBusinessRulesSchema.parse(req.body);
      const businessRules = await storage.createBusinessRules(businessRulesData, req.user.userId, req.user.companyId);
      res.json(businessRules);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/business-rules/:id", authenticateToken, requireRole(['admin', 'operador']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const businessRulesData = insertBusinessRulesSchema.partial().parse(req.body);
      const businessRules = await storage.updateBusinessRules(id, businessRulesData, req.user.companyId);
      res.json(businessRules);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Proxy OSRM para frontend
  console.log("Procurando arquivo em:", path.join(__dirname, 'osrm_url.txt'));

  app.get("/api/route", async (req, res) => {
    console.log("==== LOG INÍCIO: /api/route ====");
    // ... (rest of the code remains the same)
    console.log("Query params recebidos:");
    console.log(JSON.stringify(req.query, null, 2));

    try {
      const coords = (req.query.coords as string) || "";
      if (!coords.trim()) {
        console.log("❌ ERRO: Parâmetro 'coords' ausente");
        console.log("==== LOG FIM: /api/route (ERRO) ====");
        return res.status(400).json({ error: "Missing 'coords' parameter" });
      }

      // Helpers de normalização
      type Pair = { lat: number; lng: number };
      const BRAZIL = { latMin: -34.0, latMax: 5.5, lngMin: -74.5, lngMax: -34.0 };
      const inBrazil = (p: Pair) =>
        p.lat >= BRAZIL.latMin && p.lat <= BRAZIL.latMax &&
        p.lng >= BRAZIL.lngMin && p.lng <= BRAZIL.lngMax;
      const parseNumber = (s: string) => Number(String(s).replace(",", "."));
      const to6 = (n: number) => Number(n.toFixed(6));

      // Parse “a,b;c,d;...”
      const rawPairs = coords.split(";").map(p => p.trim()).filter(Boolean);
      if (rawPairs.length < 2) {
        console.log("❌ ERRO: Coordenadas insuficientes");
        console.log("==== LOG FIM: /api/route (ERRO) ====");
        return res.status(400).json({ error: "São necessárias pelo menos 2 coordenadas para calcular uma rota" });
      }

      const parsed = rawPairs.map((p) => {
        const [a, b] = p.split(",").map(parseNumber);
        return { a, b };
      });

      // Detecta se veio "lat,lng" (comum no front) ou "lng,lat" (padrão OSRM)
      const normalized: Pair[] = parsed.map(({ a, b }) => {
        const asLngLat = { lat: b, lng: a }; // interpretando "a,b" como "lng,lat"
        const asLatLng = { lat: a, lng: b }; // interpretando "a,b" como "lat,lng"
        if (inBrazil(asLngLat) && !inBrazil(asLatLng)) return asLngLat; // já estava OSRM
        if (inBrazil(asLatLng) && !inBrazil(asLngLat)) return asLatLng; // veio lat,lng
        // Empate: preferimos lat,lng (mais comum no front) e depois convertemos
        return asLatLng;
      });

      const swapSuspect = normalized.some(p => !inBrazil(p)) &&
        normalized.some(p => inBrazil({ lat: p.lng as any, lng: p.lat as any }));

      // Monta string final no padrão OSRM: "lng,lat;lng,lat;..."
      const osrmCoords = normalized.map(p => `${to6(p.lng)},${to6(p.lat)}`).join(";");

      // URL do OSRM (sem barra ao final)
      const OSRM_URL = getOsrmUrl()?.replace(/\/$/, "") || null;
      console.log("🌐 OSRM_URL configurado:", OSRM_URL);
      if (!OSRM_URL) {
        console.log("❌ ERRO: OSRM_URL não configurado");
        console.log("==== LOG FIM: /api/route (ERRO CONFIG) ====");
        return res.status(500).json({ error: "Endereço OSRM não configurado. Crie/atualize o arquivo osrm_url.txt." });
      }

      const osrmUrl = `${OSRM_URL}/route/v1/driving/${osrmCoords}?overview=full&geometries=geojson`;

      console.log("🧭 DEBUG /api/route:", JSON.stringify({
        raw: coords,
        parsedPairs: rawPairs.length,
        normalizedSample: normalized[0],
        osrmCoords,
        swapSuspect
      }, null, 2));

      console.log("🚀 Fazendo chamada para OSRM...");
      const osrmRes = await fetch(osrmUrl, { headers: { "ngrok-skip-browser-warning": "true" } });
      console.log("📦 Status da resposta OSRM:", osrmRes.status);

      if (!osrmRes.ok) {
        const text = await osrmRes.text();
        console.log("❌ ERRO OSRM - Resposta completa (primeiros 500 chars):");
        console.log(text.slice(0, 500));
        console.log("==== LOG FIM: /api/route (ERRO OSRM) ====");
        return res.status(500).json({ error: `OSRM error: ${text.substring(0, 300)}` });
      }

      const data = await osrmRes.json();
      console.log("✅ Rota OSRM calculada com sucesso");
      console.log("📊 Rotas:", data.routes?.length || 0, "Waypoints:", data.waypoints?.length || 0);
      if (data.routes?.[0]) {
        console.log(`- Distância: ${data.routes[0].distance} m  - Duração: ${data.routes[0].duration} s`);
      }
      console.log("==== LOG FIM: /api/route (SUCESSO) ====");
      return res.json(data);
    } catch (err: any) {
      console.log("❌ ERRO EXCEÇÃO no proxy OSRM:");
      console.log("Mensagem:", err.message);
      console.log("Stack:", err.stack);
      console.log("==== LOG FIM: /api/route (EXCEÇÃO) ====");
      return res.status(500).json({ error: "Erro no proxy OSRM", details: err.message });
    }
  });

  // ============================================================
  // ROTAS (Histórico) - Detalhe enriquecido e inclusão em lote
  // ============================================================

  // GET /api/routes/:id  -> detalhe da rota com clientName/scheduledDate nas paradas
  app.get("/api/routes/:id", authenticateToken, async (req: any, res) => {
    try {
      const routeId = req.params.id as string;

      const [routeRow] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
      if (!routeRow) return res.status(404).json({ error: "Rota não encontrada" });

      // 1) Traz as paradas com o JOIN normal (para as novas, via appointment_numeric_id)
      let stops = await db
        .select({
          id: routeStops.id,
          routeId: routeStops.routeId,
          appointmentId: routeStops.appointmentId,               // uuid legado
          appointmentNumericId: routeStops.appointmentNumericId, // vínculo real (novas)
          order: routeStops.order,
          lat: routeStops.lat,
          lng: routeStops.lng,
          address: routeStops.address,

          // enriquecimento (quando houver vínculo)
          clientName: clients.name,
          scheduledDate: appointments.scheduledDate,
        })
        .from(routeStops)
        .leftJoin(appointments, eq(routeStops.appointmentNumericId, appointments.id))
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(eq(routeStops.routeId, routeId))
        .orderBy(routeStops.order);

      // 2) Fallback: algumas paradas antigas não têm appointment_numeric_id -> clientName vem vazio.
      //    Para elas, vamos achar o cliente mais próximo por coordenadas e preencher clientName.
      const needsFallback = stops.some((s: any) => !s.clientName && Number.isFinite(s.lat) && Number.isFinite(s.lng));
      if (needsFallback) {
        // pega todos clientes com coordenadas
        const allClients = await db
          .select({
            id: clients.id,
            name: clients.name,
            lat: clients.lat,
            lng: clients.lng,
          })
          .from(clients);

        // função simples de distância (Haversine) em metros
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const distMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
          const R = 6371000; // raio da Terra em metros
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        // tolerância de 80 m (ajuste se quiser mais/menos estrito)
        const THRESHOLD_M = 80;

        stops = stops.map((s: any) => {
          if (s.clientName) return s; // já veio do JOIN normal
          if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return s;

          let best: { name: string; d: number } | null = null;
          for (const c of allClients) {
            if (!Number.isFinite(c.lat as any) || !Number.isFinite(c.lng as any)) continue;
            const d = distMeters(Number(s.lat), Number(s.lng), Number(c.lat), Number(c.lng));
            if (best === null || d < best.d) best = { name: c.name as string, d };
          }

          if (best && best.d <= THRESHOLD_M) {
            return { ...s, clientName: best.name };
          }
          return s; // sem fallback (mantém como está)
        });
      }

      return res.json({ route: routeRow, stops });
    } catch (err: any) {
      console.error("❌ [/api/routes/:id] ERRO:", err?.message);
      return res.status(500).json({ error: "Falha ao carregar detalhes da rota" });
    }
  });

  // POST /api/routes/:id/stops/bulk-add  -> inclui vários agendamentos existentes na rota
  app.post("/api/routes/:id/stops/bulk-add", authenticateToken, async (req: any, res) => {
    try {
      const routeId = req.params.id as string;
      const { appointmentIds } = req.body as { appointmentIds: number[] };

      if (!routeId) return res.status(400).json({ error: "routeId ausente" });
      if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return res.status(400).json({ error: "Envie appointmentIds[]" });
      }

      // Confirma rota
      const [routeRow] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
      if (!routeRow) return res.status(404).json({ error: "Rota não encontrada" });

      // Busca appointments + cliente (para lat/lng e endereço)
      const appts = await db
        .select({
          id: appointments.id,
          clientId: appointments.clientId,
          scheduledDate: appointments.scheduledDate,
          status: appointments.status,
          logradouro: appointments.logradouro,
          numero: appointments.numero,
          bairro: appointments.bairro,
          cidade: appointments.cidade,
          cep: appointments.cep,

          clientName: clients.name,
          lat: clients.lat,
          lng: clients.lng,
        })
        .from(appointments)
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(inArray(appointments.id, appointmentIds));

      if (appts.length === 0) {
        return res.status(404).json({ error: "Agendamentos não encontrados" });
      }

      // Validar coordenadas
      const noCoords = appts.filter(a => a.lat == null || a.lng == null);
      if (noCoords.length > 0) {
        return res.status(400).json({
          error: "Alguns agendamentos não possuem coordenadas do cliente (lat/lng). Geocodifique os clientes primeiro.",
          missing: noCoords.map(a => a.id),
        });
      }

      // 🚫 Validação: Máximo de paradas por rota
      const brOwnerFilter = eq(businessRules.companyId, req.user.companyId);
      const [brRule] = await db.select().from(businessRules).where(brOwnerFilter).limit(1);
      if (brRule) {
        const maxStops = (brRule as any).maximoParadasPorRota;
        if (maxStops && Number(maxStops) > 0) {
          // Contar paradas existentes na rota
          const [countRow] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(routeStops)
            .where(eq(routeStops.routeId, routeId));
          const currentStops = Number(countRow?.count || 0);
          const totalAfterAdd = currentStops + appts.length;
          if (totalAfterAdd > Number(maxStops)) {
            const remaining = Math.max(0, Number(maxStops) - currentStops);
            return res.status(400).json({
              error: `Limite de paradas excedido. A rota já possui ${currentStops} parada(s) e o máximo é ${maxStops}. Você pode adicionar no máximo ${remaining} parada(s).`,
              maxStops: Number(maxStops),
              currentStops,
              requested: appts.length,
              remaining,
            });
          }
        }
      }

      // Próximo 'order' da rota
      const [maxOrderRow] = await db
        .select({ max: sql<number>`COALESCE(MAX(${routeStops.order}), 0)` })
        .from(routeStops)
        .where(eq(routeStops.routeId, routeId));
      let nextOrder = Number(maxOrderRow?.max || 0) + 1;

      // Monta inserts
      const toInsert = appts.map(a => {
        const address = [a.logradouro, a.numero, a.bairro, a.cidade].filter(Boolean).join(", ");
        return {
          routeId,
          appointmentId: crypto.randomUUID(),     // ainda cumpre o NOT NULL do schema legado
          appointmentNumericId: a.id,             // vínculo REAL com appointments.id (integer)
          order: nextOrder++,
          lat: Number(a.lat),
          lng: Number(a.lng),
          address,
        };
      });

      const inserted = await db.insert(routeStops).values(toInsert).returning();

      // Reset appointment status and clear execution data
      await db
        .update(appointments)
        .set({
          status: 'scheduled',
          executionStatus: null,
          executionStartedAt: null,
          executionFinishedAt: null,
          executionStartLocation: null, // If column exists
          executionEndLocation: null,   // If column exists
          // We can also clear signature/photos if we want to be thorough, but maybe risky?
          // User said "stale appointment data... clear or ignored". Clearing is safer for UI.
          signature: null,
          photos: null,
          feedback: null
        })
        .where(inArray(appointments.id, appointmentIds));

      // Atualiza contador de paradas (mantém o que já existia + novas)
      await db
        .update(routes)
        .set({ stopsCount: (routeRow.stopsCount || 0) + inserted.length, updatedAt: nowInSaoPaulo() })
        .where(eq(routes.id, routeId));

      // Payload enriquecido para a UI
      const payload = inserted.map(s => {
        const a = appts.find(x => x.id === s.appointmentNumericId);
        return {
          ...s,
          clientName: a?.clientName ?? null,
          scheduledDate: a?.scheduledDate ?? null,
        };
      });

      return res.json({ added: payload });
    } catch (err: any) {
      console.error("❌ [/api/routes/:id/stops/bulk-add] ERRO:", err?.message);
      return res.status(500).json({ error: "Falha ao incluir agendamentos na rota" });
    }
  });

  // GET /api/routes/:id/available-appointments
  // Retorna agendamentos do mesmo dia da rota, do usuário logado,
  // com status 'scheduled' que NÃO estão em rotas confirmadas ou finalizadas
  app.get("/api/routes/:id/available-appointments", authenticateToken, async (req: any, res) => {
    try {
      const routeId = req.params.id as string;

      // 1) Carrega a rota (para saber o dia)
      const [routeRow] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
      if (!routeRow) return res.status(404).json({ error: "Rota não encontrada" });

      // 2) Define range do dia
      const routeDay = new Date(routeRow.date);
      const start = new Date(routeDay);
      start.setHours(0, 0, 0, 0);
      const end = new Date(routeDay);
      end.setHours(23, 59, 59, 999);

      // 3) Busca candidatos: agendamentos do dia com status scheduled
      const { and, gte, lte, inArray } = await import("drizzle-orm");
      const candidatesFull = await db
        .select({
          id: appointments.id,
          clientId: appointments.clientId,
          scheduledDate: appointments.scheduledDate,
          status: appointments.status,
          logradouro: appointments.logradouro,
          numero: appointments.numero,
          bairro: appointments.bairro,
          cidade: appointments.cidade,
          cep: appointments.cep,
          clientName: clients.name,
          lat: clients.lat,
          lng: clients.lng,
        })
        .from(appointments)
        .leftJoin(clients, eq(appointments.clientId, clients.id))
        .where(
          and(
            eq(appointments.companyId, req.user.companyId),
            gte(appointments.scheduledDate, start),
            lte(appointments.scheduledDate, end),
            eq(appointments.status, "scheduled")
          )
        )
        .orderBy(appointments.scheduledDate);

      if (candidatesFull.length === 0) return res.json([]);

      const candidateIds = candidatesFull.map((c) => c.id);

      // 4a) Busca agendamentos que já estão na MESMA rota (para não duplicar)
      const usedInThisRoute = await db
        .select({ numericId: routeStops.appointmentNumericId })
        .from(routeStops)
        .where(eq(routeStops.routeId, routeId));

      const usedInThisRouteIds = new Set(
        usedInThisRoute.map((s) => s.numericId).filter((x): x is number => x !== null)
      );

      // 4b) Busca bloqueios: agendamentos em rotas CONFIRMADAS ou FINALIZADAS
      const blockedStops = await db
        .select({ numericId: routeStops.appointmentNumericId })
        .from(routeStops)
        .innerJoin(routes, eq(routeStops.routeId, routes.id))
        .where(
          and(
            inArray(routeStops.appointmentNumericId, candidateIds),
            inArray(routes.status, ["confirmado", "finalizado"])
          )
        );

      const blockedIds = new Set(blockedStops.map((s) => s.numericId));

      // 5) Filtra candidatos:
      //    - Remove os que já estão na MESMA rota
      //    - Remove os que estão em rotas confirmadas/finalizadas
      const available = candidatesFull.filter(
        (c) => !usedInThisRouteIds.has(c.id) && !blockedIds.has(c.id)
      );

      // DEBUG LOG
      console.log("[available-appointments] candidateIds:", candidateIds);
      console.log("[available-appointments] usedInThisRouteIds:", Array.from(usedInThisRouteIds));
      console.log("[available-appointments] blockedIds:", Array.from(blockedIds));
      console.log("[available-appointments] available count:", available.length);

      return res.json(available);
    } catch (err: any) {
      console.error("❌ [/api/routes/:id/available-appointments] ERRO:", err?.message);
      return res.status(500).json({ error: "Falha ao listar agendamentos disponíveis para a rota" });
    }
  });


  // ==================== VEHICLE CHECKLISTS ROUTES ====================

  // Criar novo checklist
  app.post("/api/vehicle-checklists", authenticateToken, async (req: any, res) => {
    try {
      console.log("📋 [CHECKLIST] Criando novo checklist de veículo");

      const { items, ...checklistData } = req.body;

      // Validar dados do checklist (sem userId e companyId)
      const validatedChecklist = insertVehicleChecklistSchema.parse(checklistData);

      // Adicionar userId e companyId APÓS a validação (o schema os omite)
      const checklistWithUser = {
        ...validatedChecklist,
        userId: req.user.userId,
        companyId: req.user.companyId,
      };

      // Validar items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "É necessário incluir ao menos um item no checklist" });
      }

      const validatedItems = items.map((item: any) =>
        insertVehicleChecklistItemSchema.parse(item)
      );

      // Verificar se o veículo existe e pertence à empresa
      const vehicle = await storage.getVehicle(checklistWithUser.vehicleId, req.user.companyId);
      if (!vehicle) {
        return res.status(404).json({ message: "Veículo não encontrado" });
      }

      // Verificar se técnico existe
      if (checklistWithUser.technicianId) {
        const technician = await storage.getTechnician(checklistWithUser.technicianId, req.user.companyId);
        if (!technician) {
          return res.status(404).json({ message: "Técnico não encontrado" });
        }
      }

      // TODO: Validar teamMemberId quando a tabela teamMembers for criada no schema

      // Inserir checklist (type assertion necessária pois userId/companyId são adicionados após validação)
      const [newChecklist] = await db.insert(vehicleChecklists).values(checklistWithUser as any).returning();

      // Inserir items com checklistId
      const itemsWithChecklistId = validatedItems.map(item => ({
        ...item,
        checklistId: newChecklist.id,
      }));

      await db.insert(vehicleChecklistItems).values(itemsWithChecklistId);

      console.log(`✅ [CHECKLIST] Checklist ${newChecklist.id} criado com ${items.length} itens`);

      res.status(201).json(newChecklist);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("❌ [CHECKLIST] Erro de validação:", error.errors);
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      console.error("❌ [CHECKLIST] Erro ao criar checklist:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Listar checklists com filtros
  app.get("/api/vehicle-checklists", authenticateToken, async (req: any, res) => {
    try {
      console.log("📋 [CHECKLIST] Listando checklists com filtros:", req.query);

      const { vehicleId, checklistType, technicianId, startDate, endDate } = req.query;

      let query = db.select().from(vehicleChecklists).where(eq(vehicleChecklists.companyId, req.user.companyId));

      // Aplicar filtros
      const conditions: any[] = [eq(vehicleChecklists.companyId, req.user.companyId)];

      if (vehicleId) {
        conditions.push(eq(vehicleChecklists.vehicleId, parseInt(vehicleId as string)));
      }

      if (checklistType) {
        conditions.push(eq(vehicleChecklists.checklistType, checklistType as string));
      }

      if (technicianId) {
        conditions.push(eq(vehicleChecklists.technicianId, parseInt(technicianId as string)));
      }

      if (startDate) {
        conditions.push(sql`${vehicleChecklists.checkDate} >= ${new Date(startDate as string)}`);
      }

      if (endDate) {
        conditions.push(sql`${vehicleChecklists.checkDate} <= ${new Date(endDate as string)}`);
      }

      const checklists = await db.select().from(vehicleChecklists).where(and(...conditions)).orderBy(sql`${vehicleChecklists.checkDate} DESC`);

      // Buscar dados relacionados (veículo, técnico, items) para cada checklist
      const checklistsWithDetails = await Promise.all(checklists.map(async (checklist) => {
        const vehicle = await storage.getVehicle(checklist.vehicleId, req.user.companyId);

        let responsibleName = "Desconhecido";
        if (checklist.technicianId) {
          const tech = await storage.getTechnician(checklist.technicianId, req.user.companyId);
          if (tech) responsibleName = tech.name;
        } else if (checklist.teamMemberId) {
          const [teamMember] = await db.select().from(teamMembers).where(eq(teamMembers.id, checklist.teamMemberId)).limit(1);
          if (teamMember) {
            const tech = await storage.getTechnician(teamMember.technicianId, req.user.companyId);
            if (tech) responsibleName = tech.name;
          }
        }

        const items = await db.select().from(vehicleChecklistItems).where(eq(vehicleChecklistItems.checklistId, checklist.id));

        return {
          ...checklist,
          vehicle: vehicle ? { plate: vehicle.plate, model: vehicle.model, brand: vehicle.brand } : null,
          responsibleName,
          itemsCount: items.length,
        };
      }));

      console.log(`✅ [CHECKLIST] ${checklistsWithDetails.length} checklists encontrados`);

      res.json(checklistsWithDetails);
    } catch (error: any) {
      console.error("❌ [CHECKLIST] Erro ao listar checklists:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Consultar checklist específico por ID
  app.get("/api/vehicle-checklists/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`📋 [CHECKLIST] Consultando checklist ${id}`);

      const [checklist] = await db.select().from(vehicleChecklists).where(
        and(
          eq(vehicleChecklists.id, id),
          eq(vehicleChecklists.companyId, req.user.companyId)
        )
      ).limit(1);

      if (!checklist) {
        return res.status(404).json({ message: "Checklist não encontrado" });
      }

      // Buscar dados relacionados
      const vehicle = await storage.getVehicle(checklist.vehicleId, req.user.companyId);

      let responsibleName = "Desconhecido";
      if (checklist.technicianId) {
        const tech = await storage.getTechnician(checklist.technicianId, req.user.companyId);
        if (tech) responsibleName = tech.name;
      } else if (checklist.teamMemberId) {
        const [teamMember] = await db.select().from(teamMembers).where(eq(teamMembers.id, checklist.teamMemberId)).limit(1);
        if (teamMember) {
          const tech = await storage.getTechnician(teamMember.technicianId, req.user.companyId);
          if (tech) responsibleName = tech.name;
        }
      }

      const items = await db.select().from(vehicleChecklistItems).where(eq(vehicleChecklistItems.checklistId, checklist.id));

      const checklistWithDetails = {
        ...checklist,
        vehicle: vehicle ? { plate: vehicle.plate, model: vehicle.model, brand: vehicle.brand, year: vehicle.year } : null,
        responsibleName,
        items,
      };

      console.log(`✅ [CHECKLIST] Checklist ${id} retornado com ${items.length} itens`);

      res.json(checklistWithDetails);
    } catch (error: any) {
      console.error("❌ [CHECKLIST] Erro ao consultar checklist:", error);
      res.status(500).json({ message: error.message });
    }
  });


  // Registrar rotas de otimização
  const { registerRoutesAPI } = await import("./routes/routes.api");
  registerRoutesAPI(app);

  // Registrar rotas de gestão de usuários (LGPD)
  registerUserManagementRoutes(app, authenticateToken);

  // Registrar rotas de controle de horário de acesso
  registerAccessSchedulesRoutes(app, authenticateToken);

  // Registrar rotas de restrição de datas (feriados / indisponibilidades)
  registerDateRestrictionsRoutes(app, authenticateToken);

  // Endpoint para registrar localização em tempo real
  app.post("/api/tracking/location", authenticateToken, async (req: any, res) => {
    try {
      const companyId = requireCompanyId(req, res);
      if (!companyId) return;

      const locationData = req.body;
      const tracking = await storage.createTrackingLocation({
        ...locationData,
        userId: req.user.userId,
        companyId,
      });
      res.json(tracking);
    } catch (error: any) {
      console.error("Error creating tracking location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint para recuperar o rastro de uma rota
  app.get("/api/tracking/route/:routeId", authenticateToken, async (req: any, res) => {
    try {
      const companyId = requireCompanyId(req, res);
      if (!companyId) return;

      const { routeId } = req.params;
      const trackingPoints = await storage.getRouteTrackingLocations(routeId, companyId);
      res.json(trackingPoints);
    } catch (error: any) {
      console.error("Error fetching route tracking:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Registrar rotas de multiempresa (companies, memberships, invitations)
  registerCompanyRoutes(app, authenticateToken);

  // Registrar rotas de extensão de veículos (auditorias, dashboard)
  registerVehicleExtensionRoutes(app, authenticateToken);

  // Registrar rotas de métricas (apenas superadmin)
  registerMetricsRoutes(app, authenticateToken);

  // Registrar rotas de auditoria (admin de empresa)
  registerAuditRoutes(app, authenticateToken);

  // Registrar rotas do dashboard (métricas e KPIs)
  const { registerDashboardRoutes } = await import("./routes/dashboard.routes");
  registerDashboardRoutes(app, authenticateToken);

  // Registrar rotas de métricas de ADS/Marketing
  const { registerAdsMetricsRoutes } = await import("./routes/ads-metrics.routes");
  registerAdsMetricsRoutes(app, authenticateToken);

  // 🔐 Registrar rotas de SuperAdmin (métricas por empresa)
  const { registerSuperadminRoutes } = await import("./routes/superadmin.routes");
  registerSuperadminRoutes(app, authenticateToken);

  // Registrar rotas de Leads
  const { registerLeadsRoutes } = await import("./routes/leads.routes");
  registerLeadsRoutes(app, authenticateToken);

  const httpServer = createServer(app);

  // CEP Proxy to avoid CORS
  app.get("/api/cep/:cep", async (req, res) => {
    try {
      const { cep } = req.params;
      const cleanCep = cep.replace(/\D/g, '');

      if (cleanCep.length !== 8) {
        return res.status(400).json({ message: "CEP inválido" });
      }

      console.log(`Searching CEP: ${cleanCep}`);

      // 1. Tentar ViaCEP
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
          headers: { 'User-Agent': 'RotaFacil/1.0' }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const data = await response.json();
        if (data.erro) throw new Error("CEP não encontrado no ViaCEP");

        return res.json(data);
      } catch (error: any) {
        console.warn(`WARNING: ViaCEP falhou (${error.message || error}), tentando BrasilAPI...`);
      }

      // 2. Fallback: BrasilAPI
      try {
        console.log(`Tentando BrasilAPI para ${cleanCep}...`);
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        if (!response.ok) throw new Error(`Status ${response.status}`);

        const data = await response.json();

        // Mapear para formato ViaCEP
        return res.json({
          cep: data.cep,
          logradouro: data.street,
          complemento: "",
          bairro: data.neighborhood,
          localidade: data.city,
          uf: data.state,
        });
      } catch (error: any) {
        console.error(`ERROR: Ambas APIs de CEP falharam para ${cleanCep}.`, error);
        return res.status(404).json({ message: "CEP não encontrado (serviços indisponíveis)" });
      }
    } catch (error: any) {
      console.error("Critical error in CEP endpoint:", error);
      res.status(500).json({ message: "Erro interno ao buscar CEP" });
    }
  });

  // CNPJ Proxy to avoid CORS
  app.get("/api/cnpj/:cnpj", async (req, res) => {
    try {
      const { cnpj } = req.params;
      const cleanCnpj = cnpj.replace(/\D/g, '');

      if (cleanCnpj.length !== 14) {
        return res.status(400).json({ 
          success: false,
          message: "CNPJ inválido. Informe um CNPJ com 14 dígitos." 
        });
      }

      console.log(`🔍 [CNPJ] Iniciando consulta: ${cleanCnpj}`);

      // Consultar BrasilAPI com timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'RotaFacil/1.0' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`⚠️ [CNPJ] BrasilAPI retornou status ${response.status} para ${cleanCnpj}`);
          return res.status(404).json({ 
            success: false,
            message: "CNPJ não encontrado na base de dados da Receita Federal." 
          });
        }

        const data = await response.json();

        console.log(`✅ [CNPJ] Consulta bem-sucedida: ${data.razao_social || 'N/A'}`);

        // Mapear para formato padronizado
        return res.json({
          success: true,
          data: {
            razaoSocial: data.razao_social || "",
            nomeFantasia: data.nome_fantasia || "",
            cnpj: data.cnpj || cleanCnpj,
            email: data.email || "",
            telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1 || ""}`.trim() : "",
            cep: data.cep || "",
            logradouro: data.logradouro || "",
            numero: data.numero || "",
            bairro: data.bairro || "",
            cidade: data.municipio || "",
            uf: data.uf || "",
            situacao: data.descricao_situacao_cadastral || "",
            cnaePrincipal: data.cnae_fiscal_descricao || ""
          }
        });

      } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
          console.error(`⏱️ [CNPJ] Timeout na consulta de ${cleanCnpj}`);
          return res.status(504).json({ 
            success: false,
            message: "Tempo de consulta excedido. Tente novamente." 
          });
        }

        console.error(`❌ [CNPJ] Erro ao consultar BrasilAPI para ${cleanCnpj}:`, error.message);
        return res.status(500).json({ 
          success: false,
          message: "Não foi possível consultar o CNPJ no momento." 
        });
      }

    } catch (error: any) {
      console.error("❌ [CNPJ] Erro crítico no endpoint:", error);
      res.status(500).json({ 
        success: false,
        message: "Erro interno ao buscar CNPJ." 
      });
    }
  });

  return httpServer;
}
