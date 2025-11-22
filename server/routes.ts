import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import crypto from "node:crypto"; // para randomUUID
import { db } from "./db"; // ajuste o caminho se o seu db estiver noutro arquivo
import { routes, routeStops, appointments, clients, dailyAvailability } from "@shared/schema";
import { eq, inArray, sql, and, or } from "drizzle-orm";
import {
  insertUserSchema, loginSchema, insertClientSchema, insertServiceSchema,
  insertTechnicianSchema, insertVehicleSchema, insertAppointmentSchema,
  insertChecklistSchema, insertBusinessRulesSchema, insertTeamSchema,
  insertTeamMemberSchema, extendedInsertAppointmentSchema
} from "@shared/schema";
import {
  validateTechnicianTeamConflict,
  updateAvailabilityForAppointment,
  updateDailyAvailability,
  validateDateRestriction,
} from "./availability-helpers";
import { validateWorkSchedule } from "./work-schedule-validator";
import { registerUserManagementRoutes } from "./routes/user-management.routes";
import { registerAccessSchedulesRoutes } from "./routes/access-schedules.routes";
import { registerDateRestrictionsRoutes } from "./routes/date-restrictions.routes";
import { registerCompanyRoutes } from "./routes/company.routes";
import { isAccessAllowed, getAccessDeniedMessage } from "./access-schedule-validator";

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
  const filePath = path.join(__dirname, 'osrm_url.txt');
  console.log("Procurando arquivo em:", filePath);
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch (err) {
    console.error('Arquivo osrm_url.txt não encontrado ou não lido!', err);
    return null;
  }
}

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

      // Decodificar o token e adicionar ao req.user
      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user', // Importante: incluir o role
        companyId: decoded.companyId,
        companyRole: decoded.companyRole,
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

// ==================== GEO HELPERS (NOMINATIM) ====================

// Monta um endereço completo a partir do registro do AGENDAMENTO.
// Tenta cobrir diferentes nomes de campos que você possa ter no schema.
function composeFullAddressFromAppointment(a: any) {
  const street = a?.address || a?.street || a?.logradouro;
  const number = a?.number || a?.numero;
  const neighborhood = a?.neighborhood || a?.bairro || a?.district;
  const city = a?.city || a?.cidade;
  const state = a?.state || a?.uf || a?.estado;
  const zip = a?.zip || a?.zipcode || a?.cep;

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
async function geocodeWithNominatim(fullAddress: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;
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
  return { lat: latNum, lng: lngNum };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ================================================================

export async function registerRoutes(app: Express): Promise<Server> {
  // Endpoint para gerar matriz do OSRM
  app.post('/api/rota/matrix', async (req, res) => {
    console.log("==== LOG INÍCIO: /api/rota/matrix ====");
    console.log("Dados recebidos no req.body:");
    console.log(JSON.stringify(req.body, null, 2));

    const { coords } = req.body; // Ex: [[lon, lat], [lon, lat], ...]
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
      console.log("❌ ERRO: Coordenadas inválidas");
      console.log("Coordenadas recebidas:", coords);
      console.log("==== LOG FIM: /api/rota/matrix (ERRO) ====");
      return res.status(400).json({ error: 'Coordenadas inválidas' });
    }

    const coordStr = coords.map((c: number[]) => c.join(',')).join(';');
    const OSRM_URL = getOsrmUrl()?.replace(/\/$/, '') || null;
    console.log("🌐 OSRM_URL configurado:", OSRM_URL);

    if (!OSRM_URL) {
      console.log("❌ ERRO: OSRM_URL não configurado");
      console.log("==== LOG FIM: /api/rota/matrix (ERRO CONFIG) ====");
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
        console.log("❌ ERRO: OSRM não retornou durations ou distances");
        console.log("==== LOG FIM: /api/rota/matrix (ERRO OSRM) ====");
        return res.status(500).json({ error: 'OSRM não respondeu corretamente - durations ou distances não encontradas' });
      }

      console.log("✅ Matriz de durações extraída:");
      console.log(JSON.stringify(data.durations, null, 2));
      console.log("✅ Matriz de distâncias extraída:");
      console.log(JSON.stringify(data.distances, null, 2));
      console.log("==== LOG FIM: /api/rota/matrix (SUCESSO) ====");

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
    console.log("==== LOG INÍCIO: /api/rota/tsp ====");
    console.log("Dados recebidos no req.body:");
    console.log(JSON.stringify(req.body, null, 2));

    const { matrix, terminarNoPontoInicial } = req.body;
    if (!matrix || !Array.isArray(matrix)) {
      console.log("❌ ERRO: Matriz inválida");
      console.log("Matriz recebida:", matrix);
      console.log("==== LOG FIM: /api/rota/tsp (ERRO) ====");
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
      console.log("❌ ERRO: Executável Python não encontrado:", pyBin);
      console.log("==== LOG FIM: /api/rota/tsp (ERRO) ====");
      return res.status(500).json({
        error: 'Executável Python não encontrado',
        path: pyBin,
        suggestion: 'Verifique se o ambiente virtual está configurado ou defina PYTHON_BIN no .env'
      });
    }

    // Verifica se o script TSP existe
    if (!fs.existsSync(tspScript)) {
      console.log("❌ ERRO: Script TSP não encontrado:", tspScript);
      console.log("==== LOG FIM: /api/rota/tsp (ERRO) ====");
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
      console.log("❌ ERRO ao iniciar processo Python:", spawnError.message);
      console.log("==== LOG FIM: /api/rota/tsp (ERRO SPAWN) ====");
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
      console.log("❌ ERRO no processo Python:", spawnError.message);
      console.log("==== LOG FIM: /api/rota/tsp (ERRO PROCESSO) ====");
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
        console.log("==== LOG FIM: /api/rota/tsp (TIMEOUT) ====");
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
        console.log("==== LOG FIM: /api/rota/tsp (ERRO PYTHON) ====");
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
          console.log("❌ STDOUT vazio - JSON ausente");
          console.log("==== LOG FIM: /api/rota/tsp (ERRO PARSE) ====");
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
        console.log("✅ Resultado TSP parseado:");
        console.log(JSON.stringify(result, null, 2));
        console.log("==== LOG FIM: /api/rota/tsp (SUCESSO) ====");
        if (!res.headersSent) {
          return res.json(result);
        }
      } catch (e: any) {
        console.log("❌ ERRO ao parsear JSON do Python:", e.message);
        console.log("Output original:", output);
        console.log("==== LOG FIM: /api/rota/tsp (ERRO PARSE) ====");
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
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

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

  app.post("/api/auth/login", async (req, res) => {
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

      // Se usuário tem memberships, usar o primeiro como padrão (pode ser expandido para seleção no futuro)
      let companyId: number | undefined;
      let companyRole: string | undefined;
      let company: any | undefined;

      if (memberships.length > 0) {
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

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          role: user.role,
          requirePasswordChange: user.requirePasswordChange,
          companyId: companyId,
          companyRole: companyRole,
          company: company ? {
            id: company.id,
            name: company.name,
          } : undefined
        },
        token
      });
    } catch (error: any) {
      // Database connection errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' ||
        error.message?.includes('database') || error.message?.includes('connection')) {
        console.error("❌ Erro de conexão com banco de dados:", error);
        return res.status(503).json({
          message: "Não foi possível conectar ao banco de dados. Verifique se o Supabase está ativo e se a DATABASE_URL está correta."
        });
      }

      // Validation errors
      if (error.name === 'ZodError') {
        console.error("❌ Erro de validação no login:", error);
        return res.status(400).json({
          message: "Dados inválidos. Verifique o email e a senha."
        });
      }

      // Generic error
      console.error("❌ Erro no login:", error);
      res.status(500).json({
        message: error.message || "Erro interno no servidor. Tente novamente."
      });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Buscar memberships do usuário
      const memberships = await storage.getMembershipsByUserId(user.id);

      // Buscar dados da empresa se tiver companyId no token
      let company: any | undefined;
      if (req.user.companyId) {
        company = await storage.getCompanyById(req.user.companyId);
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        role: user.role,
        emailVerified: user.emailVerified,
        requirePasswordChange: user.requirePasswordChange,
        isActive: user.isActive,
        companyId: req.user.companyId,
        companyRole: req.user.companyRole,
        company: company ? {
          id: company.id,
          name: company.name,
        } : undefined,
        memberships: memberships.map(m => ({
          companyId: m.companyId,
          role: m.role,
          isActive: m.isActive,
        }))
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clients routes
  app.get("/api/clients", authenticateToken, async (req: any, res) => {
    try {
      const clients = await storage.getClients(req.user.userId);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/search", authenticateToken, async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }

      const clients = await storage.searchClients(q.trim(), req.user.userId);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/clients/validate-cpf", authenticateToken, async (req: any, res) => {
    try {
      const cpf = req.query.cpf as string;
      console.log("Validação de CPF:", cpf);

      if (!cpf) {
        return res.json({ exists: false });
      }

      const existingClient = await storage.getClientByCpf(cpf, req.user.userId);

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

  app.post("/api/clients", authenticateToken, async (req: any, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData, req.user.userId);
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/clients/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("📝 [PUT /clients] payload recebido:", req.body); // <- vê se lat/lng estão vindo
      const clientData = insertClientSchema.partial().parse(req.body);
      console.log("📝 [PUT /clients] payload após Zod:", clientData); // <- confirma que lat/lng passaram
      const client = await storage.updateClient(id, clientData, req.user.userId);
      res.json(client);
    } catch (error: any) {
      console.error("❌ [PUT /clients] erro:", error);
      res.status(400).json({ message: error.message });
    }
  });


  app.post("/api/clients/import", authenticateToken, async (req: any, res) => {
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
          const validatedData = insertClientSchema.parse(clientData);
          const createdClient = await storage.createClient(validatedData, req.user.userId);

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

          if (error.message && error.message.includes('clients_cpf_unique')) {
            console.log(`🚫 CPF duplicado detectado: ${clientData.cpf || 'N/A'}`);
            friendlyErrorMessage = `Erro na importação: CPF ${clientData.cpf} já está cadastrado.`;
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

  app.delete("/api/clients/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteClient(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json({ message: "Client deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Services routes
  app.get("/api/services", authenticateToken, async (req: any, res) => {
    try {
      const services = await storage.getServices(req.user.userId);
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/services", authenticateToken, async (req: any, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData, req.user.userId);
      res.json(service);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/services/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const serviceData = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(id, serviceData, req.user.userId);
      res.json(service);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/services/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteService(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json({ message: "Service deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Technicians routes
  app.get("/api/technicians", authenticateToken, async (req: any, res) => {
    try {
      const technicians = await storage.getTechnicians(req.user.userId);
      res.json(technicians);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/technicians", authenticateToken, async (req: any, res) => {
    console.log("==== LOG INÍCIO: POST /api/technicians ====");
    console.log("Dados recebidos:");
    console.log(JSON.stringify(req.body, null, 2));

    try {
      const technicianData = insertTechnicianSchema.parse(req.body);
      console.log("✅ Dados validados pelo schema");

      const technician = await storage.createTechnician(technicianData, req.user.userId);
      console.log("✅ Técnico criado com sucesso:");
      console.log(`ID: ${technician.id}, Nome: ${technician.name}`);
      console.log("==== LOG FIM: POST /api/technicians (SUCESSO) ====");

      res.json(technician);
    } catch (error: any) {
      console.log("❌ ERRO ao criar técnico:");
      console.log("Tipo do erro:", error.constructor.name);
      console.log("Mensagem:", error.message);
      if (error.name === 'ZodError') {
        console.log("Erros de validação:");
        console.log(JSON.stringify(error.errors, null, 2));
      }
      console.log("==== LOG FIM: POST /api/technicians (ERRO) ====");

      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/technicians/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const technicianData = insertTechnicianSchema.partial().parse(req.body);
      const technician = await storage.updateTechnician(id, technicianData, req.user.userId);
      res.json(technician);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/technicians/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTechnician(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Technician not found" });
      }
      res.json({ message: "Technician deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Team Members
  app.get("/api/team-members", authenticateToken, async (req: any, res) => {
    try {
      const teamMembers = await storage.getAllTeamMembers(req.user.userId);
      res.json(teamMembers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vehicles routes
  app.get("/api/vehicles", authenticateToken, async (req: any, res) => {
    try {
      const vehicles = await storage.getVehicles(req.user.userId);
      res.json(vehicles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/vehicles", authenticateToken, async (req: any, res) => {
    try {
      const vehicleData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(vehicleData, req.user.userId);
      res.json(vehicle);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/vehicles/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const vehicleData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.updateVehicle(id, vehicleData, req.user.userId);
      res.json(vehicle);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/vehicles/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVehicle(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      res.json({ message: "Vehicle deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Appointments routes
  app.get("/api/appointments", authenticateToken, async (req: any, res) => {
    try {
      const appointments = await storage.getAppointments(req.user.userId);

      // Adicionar informação sobre romaneio confirmado/finalizado
      const appointmentsWithRouteStatus = await Promise.all(
        appointments.map(async (apt) => {

          // Verificar se o agendamento está em uma rota confirmada ou finalizada
          const routeStatus = await db
            .select({
              routeId: routes.id,
              routeStatus: routes.status,
              routeDisplayNumber: routes.displayNumber,
            })
            .from(routeStops)
            .innerJoin(
              routes,
              eq(routeStops.routeId, routes.id)
            )
            .where(
              and(
                eq(routeStops.appointmentNumericId, apt.id),
                or(
                  eq(routes.status, 'confirmado'),
                  eq(routes.status, 'finalizado')
                )
              )
            )
            .limit(1);

          return {
            ...apt,
            routeInfo: routeStatus.length > 0 ? {
              routeId: routeStatus[0].routeId,
              status: routeStatus[0].routeStatus,
              displayNumber: routeStatus[0].routeDisplayNumber,
            } : null,
          };
        })
      );

      console.log(`✅ [APPOINTMENTS] Retornando ${appointmentsWithRouteStatus.length} agendamentos com info de romaneio`);
      res.json(appointmentsWithRouteStatus);
    } catch (error: any) {
      console.error(`❌ [APPOINTMENTS] Erro ao buscar agendamentos:`, error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/appointments/date/:date", authenticateToken, async (req: any, res) => {
    try {
      const date = req.params.date;
      const appointments = await storage.getAppointmentsByDate(date, req.user.userId);
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/appointments", authenticateToken, async (req: any, res) => {
    try {
      const appointmentData = extendedInsertAppointmentSchema.parse(req.body);

      // Validar restrição de data (feriados / indisponibilidades)
      const dateRestrictionValidation = await validateDateRestriction(
        req.user.userId,
        new Date(appointmentData.scheduledDate),
        appointmentData.technicianId || null,
        appointmentData.teamId || null
      );

      if (!dateRestrictionValidation.valid) {
        return res.status(400).json({ message: dateRestrictionValidation.message });
      }

      // Validar conflito técnico/equipe
      const validation = await validateTechnicianTeamConflict(
        req.user.userId,
        new Date(appointmentData.scheduledDate),
        appointmentData.technicianId || null,
        appointmentData.teamId || null
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
        appointmentData.teamId || undefined
      );

      if (!workScheduleValidation.valid) {
        return res.status(400).json({ message: workScheduleValidation.message });
      }

      const appointment = await storage.createAppointment(appointmentData, req.user.userId);

      // Atualizar disponibilidade após criar agendamento
      await updateAvailabilityForAppointment(req.user.userId, appointment);

      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/appointments/import", authenticateToken, async (req: any, res) => {
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
              const newClient = await storage.createClient(appointmentData.clientData, req.user.userId);
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
            validatedData.teamId || null
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
            validatedData.teamId || null
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
            validatedData.teamId || undefined
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

          const createdAppointment = await storage.createAppointment(validatedData, req.user.userId);

          // Atualizar disponibilidade após criar agendamento
          await updateAvailabilityForAppointment(req.user.userId, createdAppointment);

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

  // 🔍 [ACHE UMA DATA] Endpoint para buscar datas disponíveis (streaming)
  app.post("/api/scheduling/find-available-dates", authenticateToken, async (req: any, res) => {
    try {
      const { clientId, cep, numero, logradouro, bairro, cidade, estado, serviceId, technicianId, teamId, startDate } = req.body;
      const userId = req.user.userId;
      const companyId = req.user.companyId;

      console.log("🔍 [FIND-DATE] Iniciando busca de datas disponíveis:", { clientId, cep, numero, logradouro, cidade, serviceId, technicianId, teamId });

      // 🌊 Configurar headers para streaming (Server-Sent Events)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Validações básicas
      if (!cep || !numero || !serviceId) {
        return res.status(400).json({ message: "CEP, número e serviço são obrigatórios" });
      }

      // Buscar serviço para obter duração
      const service = await storage.getService(serviceId, userId);
      if (!service) {
        return res.status(400).json({ message: "Serviço não encontrado" });
      }

      // Buscar regras de negócio
      const businessRules = await storage.getBusinessRules(userId);
      if (!businessRules) {
        return res.status(400).json({ message: "Regras de negócio não configuradas" });
      }

      const maxDistanceBetweenPoints = parseFloat(businessRules.distanciaMaximaEntrePontos || "50");
      const maxDistanceServed = parseFloat(businessRules.distanciaMaximaAtendida || "100");

      // Geocodificar endereço de destino
      let targetLat: number, targetLng: number;

      if (clientId) {
        // Buscar coordenadas do cliente
        const client = await storage.getClient(clientId, userId);
        if (!client) {
          return res.status(400).json({ message: "Cliente não encontrado" });
        }

        if (client.lat && client.lng) {
          targetLat = client.lat;
          targetLng = client.lng;
        } else {
          // Geocodificar endereço do cliente
          const fullAddress = `${client.logradouro}, ${client.numero}, ${client.cidade}, ${client.cep}, Brasil`;
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
        const fullAddress = logradouro && cidade
          ? `${logradouro}, ${numero}, ${cidade}, ${cep}, Brasil`
          : `${cep}, ${numero}, Brasil`;

        console.log("📍 [FIND-DATE] Geocodificando endereço manual:", fullAddress);
        await sleep(1000); // Rate limit Nominatim
        const coords = await geocodeWithNominatim(fullAddress);
        targetLat = coords.lat;
        targetLng = coords.lng;
      }

      console.log("✅ [FIND-DATE] Coordenadas do destino:", { targetLat, targetLng });

      // Função Haversine para calcular distância
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
        const R = 6371; // Raio da Terra em km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Buscar técnicos/equipes compatíveis com o serviço
      let responsibles: Array<{ type: 'technician' | 'team', id: number, name: string }> = [];

      if (technicianId) {
        // Técnico específico
        const tech = await storage.getTechnician(technicianId, userId);
        if (tech && tech.serviceIds?.includes(serviceId.toString())) {
          responsibles.push({ type: 'technician', id: tech.id, name: tech.name });
        }
      } else if (teamId) {
        // Equipe específica
        const team = await storage.getTeam(teamId, userId);
        if (team && team.serviceIds?.includes(serviceId.toString())) {
          responsibles.push({ type: 'team', id: team.id, name: team.name });
        }
      } else {
        // Buscar todos os técnicos compatíveis
        const allTechnicians = await storage.getTechnicians(userId);
        for (const tech of allTechnicians) {
          if (tech.serviceIds?.includes(serviceId.toString()) && tech.isActive) {
            responsibles.push({ type: 'technician', id: tech.id, name: tech.name });
          }
        }

        // Buscar todas as equipes compatíveis
        const allTeams = await storage.getTeams(userId);
        for (const team of allTeams) {
          if (team.serviceIds?.includes(serviceId.toString())) {
            responsibles.push({ type: 'team', id: team.id, name: team.name });
          }
        }
      }

      if (responsibles.length === 0) {
        return res.status(400).json({ message: "Nenhum técnico ou equipe compatível com o serviço selecionado" });
      }

      console.log(`✅ [FIND-DATE] Encontrados ${responsibles.length} responsáveis compatíveis`);

      // Buscar datas candidatas
      const today = new Date();
      const searchStartDate = startDate ? new Date(startDate) : today;
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

      for (const responsible of responsibles) {
        console.log(`🔍 [FIND-DATE] Analisando ${responsible.type} ${responsible.name}`);

        // Buscar horários de trabalho
        let horarioInicioTrabalho: string, horarioFimTrabalho: string, horarioAlmocoMinutos: number, diasTrabalho: string[];
        let baseAddress: { cep: string, logradouro: string, numero: string, cidade: string, estado: string };

        if (responsible.type === 'technician') {
          const tech = await storage.getTechnician(responsible.id, userId);
          if (!tech) continue;

          horarioInicioTrabalho = tech.horarioInicioTrabalho || '08:00';
          horarioFimTrabalho = tech.horarioFimTrabalho || '18:00';
          horarioAlmocoMinutos = tech.horarioAlmocoMinutos || 60;
          diasTrabalho = tech.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

          // Endereço de início (ou da empresa)
          if (tech.enderecoInicioCep) {
            baseAddress = {
              cep: tech.enderecoInicioCep,
              logradouro: tech.enderecoInicioLogradouro || '',
              numero: tech.enderecoInicioNumero || '',
              cidade: tech.enderecoInicioCidade || '',
              estado: tech.enderecoInicioEstado || ''
            };
          } else {
            baseAddress = {
              cep: businessRules.enderecoEmpresaCep,
              logradouro: businessRules.enderecoEmpresaLogradouro,
              numero: businessRules.enderecoEmpresaNumero,
              cidade: businessRules.enderecoEmpresaCidade,
              estado: businessRules.enderecoEmpresaEstado
            };
          }
        } else {
          const team = await storage.getTeam(responsible.id, userId);
          if (!team) continue;

          horarioInicioTrabalho = team.horarioInicioTrabalho || '08:00';
          horarioFimTrabalho = team.horarioFimTrabalho || '18:00';
          horarioAlmocoMinutos = team.horarioAlmocoMinutos || 60;
          diasTrabalho = team.diasTrabalho || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

          // Endereço de início (ou da empresa)
          if (team.enderecoInicioCep) {
            baseAddress = {
              cep: team.enderecoInicioCep,
              logradouro: team.enderecoInicioLogradouro || '',
              numero: team.enderecoInicioNumero || '',
              cidade: team.enderecoInicioCidade || '',
              estado: team.enderecoInicioEstado || ''
            };
          } else {
            baseAddress = {
              cep: businessRules.enderecoEmpresaCep,
              logradouro: businessRules.enderecoEmpresaLogradouro,
              numero: businessRules.enderecoEmpresaNumero,
              cidade: businessRules.enderecoEmpresaCidade,
              estado: businessRules.enderecoEmpresaEstado
            };
          }
        }

        const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

        console.log(`📋 [FIND-DATE] Endereço base de ${responsible.name}: ${baseAddress.logradouro}, ${baseAddress.numero} - ${baseAddress.cidade} (${baseAddress.cep})`);
        console.log(`⏰ [FIND-DATE] Horário: ${horarioInicioTrabalho} às ${horarioFimTrabalho} (${horarioAlmocoMinutos}min almoço)`);
        console.log(`📅 [FIND-DATE] Dias de trabalho: ${diasTrabalho.join(', ')}`);
        console.log(`🎯 [FIND-DATE] Limites: ${maxDistanceBetweenPoints}km entre pontos, ${maxDistanceServed}km da base`);

        // 🚀 OTIMIZAÇÃO: Pré-calcular todas as datas e buscar disponibilidades em batch
        const datesToCheck: Date[] = [];
        for (let daysAhead = 0; daysAhead < maxDaysAhead; daysAhead++) {
          const candidateDate = new Date(searchStartDate);
          candidateDate.setDate(searchStartDate.getDate() + daysAhead);
          candidateDate.setHours(0, 0, 0, 0);

          // Verificar se é dia de trabalho
          const dayOfWeek = candidateDate.getDay();
          const currentDayName = dayNames[dayOfWeek];

          // 🐛 DEBUG: Log para verificar filtro de dias
          if (daysAhead < 10) { // Log apenas primeiros 10 dias
            console.log(`  🗓️  ${candidateDate.toISOString().split('T')[0]} (${currentDayName}) - Dia de trabalho? ${diasTrabalho.includes(currentDayName)}`);
          }

          if (diasTrabalho.includes(currentDayName)) {
            datesToCheck.push(candidateDate);
          }
        }

        console.log(`🔍 [FIND-DATE] Verificando ${datesToCheck.length} dias de trabalho...`);

        // 🚀 Buscar todas as disponibilidades de uma vez
        const availabilities = await db.query.dailyAvailability.findMany({
          where: and(
            eq(dailyAvailability.userId, userId),
            eq(dailyAvailability.responsibleType, responsible.type),
            eq(dailyAvailability.responsibleId, responsible.id)
          ),
        });

        // Criar map de disponibilidades por data para acesso rápido
        const availabilityMap = new Map<string, typeof availabilities[0]>();
        for (const avail of availabilities) {
          const dateKey = new Date(avail.date).toISOString().split('T')[0];
          availabilityMap.set(dateKey, avail);
        }

        // 🚀 Atualizar apenas datas que não têm disponibilidade
        const missingDates = datesToCheck.filter(date => {
          const dateKey = date.toISOString().split('T')[0];
          return !availabilityMap.has(dateKey);
        });

        if (missingDates.length > 0) {
          console.log(`📊 [FIND-DATE] Atualizando ${missingDates.length} datas sem disponibilidade...`);
          for (const date of missingDates) {
            await updateDailyAvailability(userId, date, responsible.type, responsible.id);
          }

          // Re-buscar disponibilidades atualizadas
          const newAvailabilities = await db.query.dailyAvailability.findMany({
            where: and(
              eq(dailyAvailability.userId, userId),
              eq(dailyAvailability.responsibleType, responsible.type),
              eq(dailyAvailability.responsibleId, responsible.id)
            ),
          });

          // Atualizar o map
          for (const avail of newAvailabilities) {
            const dateKey = new Date(avail.date).toISOString().split('T')[0];
            availabilityMap.set(dateKey, avail);
          }
        }

        // Iterar pelos dias de trabalho
        let checkedDays = 0;
        let skippedNotWorkDay = maxDaysAhead - datesToCheck.length;
        let skippedNoTime = 0;
        let skippedTooFar = 0;
        let skippedGeocodeError = 0;

        for (const candidateDate of datesToCheck) {
          // ⚡ OTIMIZAÇÃO: Parar se já encontramos 10 candidatos
          if (candidates.length >= 10) {
            console.log(`⚡ [FIND-DATE] Já encontramos 10 candidatos, parando busca!`);
            break;
          }

          checkedDays++;
          const dateKey = candidateDate.toISOString().split('T')[0];
          const availability = availabilityMap.get(dateKey);

          if (!availability || availability.availableMinutes < service.duration) {
            // Não há tempo suficiente
            skippedNoTime++;
            continue;
          }

          // Buscar agendamentos do responsável no dia
          const startOfDay = new Date(candidateDate);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(candidateDate);
          endOfDay.setHours(23, 59, 59, 999);

          const dayAppointments = await db.query.appointments.findMany({
            where: and(
              eq(appointments.userId, userId),
              responsible.type === 'technician'
                ? eq(appointments.technicianId, responsible.id)
                : eq(appointments.teamId, responsible.id),
              sql`${appointments.scheduledDate} >= ${startOfDay.toISOString()}`,
              sql`${appointments.scheduledDate} <= ${endOfDay.toISOString()}`
            ),
          });

          // Calcular distância
          let minDistance = Number.POSITIVE_INFINITY;
          let distanceType: 'between_points' | 'from_base' = 'from_base';
          const dateStr = candidateDate.toISOString().split('T')[0];

          if (dayAppointments.length > 0) {
            // Calcular distância até o agendamento mais próximo
            console.log(`  📅 ${dateStr}: ${dayAppointments.length} agendamento(s) no dia`);
            for (const apt of dayAppointments) {
              if (!apt.clientId) continue;
              const aptClient = await db.query.clients.findFirst({
                where: eq(clients.id, apt.clientId),
              });

              if (aptClient?.lat && aptClient?.lng) {
                const dist = haversineDistance(aptClient.lat, aptClient.lng, targetLat, targetLng);
                if (dist < minDistance) {
                  minDistance = dist;
                  distanceType = 'between_points';
                }
              }
            }

            console.log(`  📏 Distância até ponto mais próximo: ${minDistance.toFixed(2)}km (limite: ${maxDistanceBetweenPoints}km)`);

            // Verificar limite de distância entre pontos
            if (minDistance > maxDistanceBetweenPoints) {
              console.log(`  ❌ Rejeitado: distância ${minDistance.toFixed(2)}km > limite ${maxDistanceBetweenPoints}km`);
              skippedTooFar++;
              continue; // Muito longe dos agendamentos existentes
            }
            console.log(`  ✅ Aceito: dentro do limite de distância entre pontos`);
          } else {
            // Sem agendamentos no dia - calcular distância da base
            console.log(`  📅 ${dateStr}: dia totalmente livre`);
            const baseFullAddress = `${baseAddress.logradouro}, ${baseAddress.numero}, ${baseAddress.cidade}, ${baseAddress.cep}, Brasil`;
            console.log(`  📍 Geocodificando base: ${baseFullAddress}`);

            try {
              await sleep(1000); // Rate limit Nominatim
              const baseCoords = await geocodeWithNominatim(baseFullAddress);
              console.log(`  📍 Coordenadas da base: ${baseCoords.lat}, ${baseCoords.lng}`);

              minDistance = haversineDistance(baseCoords.lat, baseCoords.lng, targetLat, targetLng);
              distanceType = 'from_base';

              console.log(`  📏 Distância da base: ${minDistance.toFixed(2)}km (limite: ${maxDistanceServed}km)`);

              // Verificar limite de distância máxima atendida
              if (minDistance > maxDistanceServed) {
                console.log(`  ❌ Rejeitado: distância ${minDistance.toFixed(2)}km > limite ${maxDistanceServed}km`);
                skippedTooFar++;
                continue; // Muito longe da base
              }
              console.log(`  ✅ Aceito: dentro do limite de distância da base`);
            } catch (error: any) {
              console.warn(`  ⚠️ Erro ao geocodificar base: ${error.message}`);
              skippedGeocodeError++;
              continue;
            }
          }

          // Adicionar candidato e enviar imediatamente via streaming
          const candidate = {
            date: candidateDate.toISOString().split('T')[0],
            responsibleType: responsible.type,
            responsibleId: responsible.id,
            responsibleName: responsible.name,
            availableMinutes: availability.availableMinutes,
            totalMinutes: availability.totalMinutes,
            usedMinutes: availability.usedMinutes,
            distance: minDistance,
            distanceType,
          };

          console.log(`  ✨ CANDIDATO ADICIONADO: ${dateStr} - ${minDistance.toFixed(2)}km (${availability.availableMinutes}min livres)`);
          candidates.push(candidate);

          // 🌊 Enviar candidato imediatamente via SSE
          res.write(`data: ${JSON.stringify(candidate)}\n\n`);
        }

        // Resumo da análise deste responsável
        console.log(`📊 [FIND-DATE] Resumo ${responsible.name}:`);
        console.log(`  - Dias verificados: ${checkedDays}`);
        console.log(`  - Não é dia de trabalho: ${skippedNotWorkDay}`);
        console.log(`  - Sem tempo suficiente: ${skippedNoTime}`);
        console.log(`  - Muito longe: ${skippedTooFar}`);
        console.log(`  - Erro geocodificação: ${skippedGeocodeError}`);
        console.log(`  - ✅ Candidatos encontrados: ${candidates.filter(c => c.responsibleId === responsible.id).length}`);
      }

      console.log(`✅ [FIND-DATE] Total de ${candidates.length} candidatos encontrados`);

      console.log(`\n🎯 [FIND-DATE] Busca concluída! ${candidates.length} opções encontradas`);

      // 🌊 Enviar evento de conclusão
      res.write('data: {"done": true}\n\n');
      res.end();
    } catch (error: any) {
      console.error("❌ [FIND-DATE] Erro:", error);
      res.write(`data: {"error": "${error.message || 'Erro ao buscar datas disponíveis'}"}\n\n`);
      res.end();
    }
  });

  app.put("/api/appointments/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const appointmentData = req.body;

      console.log(`🔧 [UPDATE] Atualizando agendamento ${id}:`, appointmentData);

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

      const appointment = await storage.updateAppointment(id, appointmentData, req.user.userId);
      console.log(`✅ [UPDATE] Agendamento atualizado com sucesso: ${appointment.id}`);
      res.json(appointment);
    } catch (error: any) {
      console.log(`❌ [UPDATE] Erro ao atualizar agendamento:`, error.message);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/appointments/:id", authenticateToken, async (req: any, res) => {
    console.log(`==== LOG INÍCIO: PATCH /api/appointments/${req.params.id} ====`);
    console.log("Dados recebidos:");
    console.log(JSON.stringify(req.body, null, 2));

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
          } catch (dateError) {
            console.log(`❌ [PATCH] Erro ao processar data:`, dateError);
            console.log("==== LOG FIM: PATCH /api/appointments (ERRO DATA) ====");
            return res.status(400).json({ message: `Data inválida: ${appointmentData.scheduledDate}` });
          }
        }
      }

      // Buscar agendamento original para validação
      const originalAppointment = await storage.getAppointment(id, req.user.userId);
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
          id // Excluir o próprio agendamento da validação
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
          appointmentData.teamId !== undefined ? appointmentData.teamId : originalAppointment.teamId
        );

        if (!workScheduleValidation.valid) {
          return res.status(400).json({ message: workScheduleValidation.message });
        }
      }

      const appointment = await storage.updateAppointment(id, appointmentData, req.user.userId);

      // Atualizar disponibilidade da data antiga se mudou a data
      if (dateChanged) {
        const oldDate = new Date(originalAppointment.scheduledDate);
        if (originalAppointment.technicianId) {
          await updateAvailabilityForAppointment(req.user.userId, { ...originalAppointment, scheduledDate: oldDate } as any);
        }
        if (originalAppointment.teamId) {
          await updateAvailabilityForAppointment(req.user.userId, { ...originalAppointment, scheduledDate: oldDate } as any);
        }
      }

      // Atualizar disponibilidade da nova data/responsável
      await updateAvailabilityForAppointment(req.user.userId, appointment);

      console.log(`✅ [PATCH] Agendamento ${id} atualizado com sucesso`);
      console.log("==== LOG FIM: PATCH /api/appointments (SUCESSO) ====");

      res.json(appointment);
    } catch (error: any) {
      console.log(`❌ [PATCH] Erro ao atualizar agendamento ${req.params.id}:`);
      console.log("Tipo do erro:", error.constructor.name);
      console.log("Mensagem:", error.message);
      console.log("==== LOG FIM: PATCH /api/appointments (ERRO) ====");

      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/appointments/:id", authenticateToken, async (req: any, res) => {
    console.log(`==== LOG INÍCIO: DELETE /api/appointments/${req.params.id} ====`);

    try {
      const id = parseInt(req.params.id);
      console.log(`🗑️ Tentando deletar agendamento ID: ${id}`);

      // Buscar agendamento antes de deletar para atualizar disponibilidade
      const appointmentToDelete = await storage.getAppointment(id, req.user.userId);

      const success = await storage.deleteAppointment(id, req.user.userId);
      if (!success) {
        console.log(`❌ Agendamento ${id} não encontrado para o usuário`);
        console.log("==== LOG FIM: DELETE /api/appointments (NÃO ENCONTRADO) ====");
        return res.status(404).json({ message: "Appointment not found" });
      }

      // Atualizar disponibilidade após deletar
      if (appointmentToDelete) {
        await updateAvailabilityForAppointment(req.user.userId, appointmentToDelete);
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
  app.post("/api/appointments/geocode-missing", authenticateToken, async (req: any, res) => {
    try {
      const ids = (req.body?.appointmentIds ?? []).filter((x: any) => Number.isFinite(x));
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "appointmentIds vazio" });
      }

      // Pega TODOS os appointments do usuário e filtra pelos IDs informados
      // (usamos storage para manter o padrão do projeto)
      const all = await storage.getAppointments(req.user.userId);
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

  // Route optimization
  app.post("/api/gerar-rota", authenticateToken, async (req: any, res) => {
    try {
      const { appointmentIds } = req.body;
      if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
        return res.status(400).json({ message: "Appointment IDs are required" });
      }

      const optimizedRoute = await storage.optimizeRoute(appointmentIds, req.user.userId);
      res.json(optimizedRoute);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Checklists routes
  app.get("/api/checklists", authenticateToken, async (req: any, res) => {
    try {
      const checklists = await storage.getChecklists(req.user.userId);
      res.json(checklists);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/checklists", authenticateToken, async (req: any, res) => {
    try {
      const checklistData = insertChecklistSchema.parse(req.body);
      const checklist = await storage.createChecklist(checklistData, req.user.userId);
      res.json(checklist);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/checklists/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const checklistData = insertChecklistSchema.partial().parse(req.body);
      const checklist = await storage.updateChecklist(id, checklistData, req.user.userId);
      res.json(checklist);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/checklists/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteChecklist(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json({ message: "Checklist deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Business Rules routes
  app.get("/api/business-rules", authenticateToken, async (req: any, res) => {
    try {
      const businessRules = await storage.getBusinessRules(req.user.userId);
      res.json(businessRules || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/business-rules", authenticateToken, async (req: any, res) => {
    try {
      const businessRulesData = insertBusinessRulesSchema.parse(req.body);
      const businessRules = await storage.createBusinessRules(businessRulesData, req.user.userId);
      res.json(businessRules);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/business-rules/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const businessRulesData = insertBusinessRulesSchema.partial().parse(req.body);
      const businessRules = await storage.updateBusinessRules(id, businessRulesData, req.user.userId);
      res.json(businessRules);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Daily Availability routes - Consulta de disponibilidade por dia/responsável
  app.get("/api/daily-availability", authenticateToken, async (req: any, res) => {
    try {
      const { startDate, endDate, responsibleType, responsibleId } = req.query;

      const { dailyAvailability } = await import("@shared/schema");
      const { and, eq, gte, lte, sql } = await import("drizzle-orm");

      const conditions = [eq(dailyAvailability.userId, req.user.userId)];

      if (startDate) {
        conditions.push(gte(dailyAvailability.date, new Date(startDate as string)));
      }
      if (endDate) {
        conditions.push(lte(dailyAvailability.date, new Date(endDate as string)));
      }
      if (responsibleType) {
        conditions.push(eq(dailyAvailability.responsibleType, responsibleType as string));
      }
      if (responsibleId) {
        conditions.push(eq(dailyAvailability.responsibleId, parseInt(responsibleId as string)));
      }

      const availability = await db.query.dailyAvailability.findMany({
        where: and(...conditions),
        orderBy: (dailyAvailability, { asc }) => [asc(dailyAvailability.date)],
      });

      res.json(availability);
    } catch (error: any) {
      console.error("❌ [AVAILABILITY] Erro ao consultar disponibilidade:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Teams routes - Nova funcionalidade conforme solicitado
  app.get("/api/teams", authenticateToken, async (req: any, res) => {
    try {
      const teams = await storage.getTeams(req.user.userId);
      res.json(teams);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/teams/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const team = await storage.getTeam(id, req.user.userId);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/teams", authenticateToken, async (req: any, res) => {
    try {
      const teamData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(teamData, req.user.userId);
      res.json(team);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/teams/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const teamData = insertTeamSchema.partial().parse(req.body);
      const team = await storage.updateTeam(id, teamData, req.user.userId);
      res.json(team);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/teams/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTeam(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Team not found" });
      }
      res.json({ message: "Team deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Team members routes - Para gerenciar membros das equipes
  app.get("/api/team-members/:teamId", authenticateToken, async (req: any, res) => {
    try {
      const teamId = parseInt(req.params.teamId);
      // getTeamMembers agora espera apenas userId, pois retorna todos os membros
      // Se precisar filtrar por teamId, fazer no array retornado ou criar método específico
      const members = await storage.getAllTeamMembers(req.user.userId);
      const teamMembers = members.filter(m => m.teamId === teamId);
      res.json(teamMembers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/team-members", authenticateToken, async (req: any, res) => {
    try {
      const memberData = insertTeamMemberSchema.parse(req.body);
      const member = await storage.createTeamMember(memberData, req.user.userId);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/team-members/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTeamMember(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json({ message: "Team member removed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Proxy OSRM para frontend
  console.log("Procurando arquivo em:", path.join(__dirname, 'osrm_url.txt'));

  app.get("/api/route", async (req, res) => {
    console.log("==== LOG INÍCIO: /api/route ====");
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

      // Atualiza contador de paradas (mantém o que já existia + novas)
      await db
        .update(routes)
        .set({ stopsCount: (routeRow.stopsCount || 0) + inserted.length, updatedAt: new Date() })
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
  // Retorna apenas agendamentos "do mesmo dia da rota", do usuário logado,
  // com status 'scheduled' e que AINDA NÃO estão nessa rota.
  app.get("/api/routes/:id/available-appointments", authenticateToken, async (req: any, res) => {
    try {
      const routeId = req.params.id as string;

      // 1) Carrega a rota (para saber o dia)
      const [routeRow] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
      if (!routeRow) return res.status(404).json({ error: "Rota não encontrada" });

      // 2) Quais agendamentos já estão nessa rota?
      const usedRows = await db
        .select({ aid: routeStops.appointmentNumericId })
        .from(routeStops)
        .where(eq(routeStops.routeId, routeId));

      const usedIds: number[] = usedRows
        .map((r) => r.aid as number | null)
        .filter((x): x is number => Number.isFinite(x));

      // 3) Monta as condições (mesmo dia da rota, usuário, status scheduled, NOT IN usados)
      //    Evita ambiguidade de tipos no Postgres usando comparação explícita por ::date
      const routeDay = new Date(routeRow.date);
      const conditions: any[] = [
        eq(appointments.userId, req.user.userId),
        sql`${appointments.scheduledDate}::date = ${routeDay}::date`,
        eq(appointments.status, "scheduled"),
      ];

      // notInArray só quando há IDs; se não, pula a condição
      if (usedIds.length > 0) {
        const { notInArray, and } = await import("drizzle-orm");
        const joined = await db
          .select({
            id: appointments.id,
            clientId: appointments.clientId,
            scheduledDate: appointments.scheduledDate,
            status: appointments.status,
            // campos úteis pra exibir
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
              ...conditions,
              notInArray(appointments.id, usedIds),
            )
          )
          .orderBy(appointments.scheduledDate);

        return res.json(joined);
      } else {
        // Sem usados — condição mais simples
        const { and } = await import("drizzle-orm");
        const joined = await db
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
          .where(and(...conditions))
          .orderBy(appointments.scheduledDate);

        return res.json(joined);
      }
    } catch (err: any) {
      console.error("❌ [/api/routes/:id/available-appointments] ERRO:", err?.message);
      return res.status(500).json({ error: "Falha ao listar agendamentos disponíveis para a rota" });
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

  // Registrar rotas de multiempresa (companies, memberships, invitations)
  registerCompanyRoutes(app, authenticateToken);

  const httpServer = createServer(app);
  return httpServer;
}