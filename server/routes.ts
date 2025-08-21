import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import crypto from "node:crypto"; // para randomUUID
import { db } from "./db"; // ajuste o caminho se o seu db estiver noutro arquivo
import { routes, routeStops, appointments, clients } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { 
  insertUserSchema, loginSchema, insertClientSchema, insertServiceSchema,
  insertTechnicianSchema, insertVehicleSchema, insertAppointmentSchema,
  insertChecklistSchema, insertBusinessRulesSchema, insertTeamSchema,
  insertTeamMemberSchema, extendedInsertAppointmentSchema
} from "@shared/schema";

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
  // 🚀 DEV MODE BYPASS: Permite acesso sem autenticação durante desenvolvimento
  if (process.env.DEV_MODE === 'true') {
    // Criar usuário fake para desenvolvimento
    req.user = {
      userId: 1,
      email: 'dev@rotafacil.com',
      name: 'Dev User',
      plan: 'premium'
    };
    return next();
  }

  // 🔐 Autenticação normal para produção
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
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
    console.log("Matriz completa:");
    console.log(JSON.stringify(matrix, null, 2));

    const { spawn } = await import('child_process');
    console.log("🐍 Iniciando processo Python...");
    const py = spawn('python3', ['./server/solve_tsp.py']);
    let output = '';
    let errors = '';
    
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

    py.on('close', (code: number) => {
      console.log(`🔚 Processo Python finalizado com código: ${code}`);
      console.log("📤 Output completo do Python:");
      console.log(output);
      
      if (errors) {
        console.log("⚠️ Erros do Python:");
        console.log(errors);
      }
      
      try {
        const result = JSON.parse(output);
        console.log("✅ Resultado TSP parseado:");
        console.log(JSON.stringify(result, null, 2));
        console.log("==== LOG FIM: /api/rota/tsp (SUCESSO) ====");
        return res.json(result);
      } catch (e: any) {
        console.log("❌ ERRO ao parsear JSON do Python:");
        console.log("Output original:", output);
        console.log("Erro de parse:", e.message);
        console.log("==== LOG FIM: /api/rota/tsp (ERRO PARSE) ====");
        return res.status(500).json({ error: 'Erro no Python', details: output, parseError: e.message });
      }
    });

    const inputData = { matrix, terminarNoPontoInicial };
    console.log("📤 Enviando dados para Python:");
    console.log(JSON.stringify(inputData, null, 2));
    
    py.stdin.write(JSON.stringify(inputData));
    py.stdin.end();
    console.log("✅ Dados enviados para Python, aguardando resposta...");
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
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
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.validateUser(email, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
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
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        plan: user.plan 
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
      res.json(appointments);
    } catch (error: any) {
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
      const appointment = await storage.createAppointment(appointmentData, req.user.userId);
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
          const createdAppointment = await storage.createAppointment(validatedData, req.user.userId);
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

      const appointment = await storage.updateAppointment(id, appointmentData, req.user.userId);
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
      
      const success = await storage.deleteAppointment(id, req.user.userId);
      if (!success) {
        console.log(`❌ Agendamento ${id} não encontrado para o usuário`);
        console.log("==== LOG FIM: DELETE /api/appointments (NÃO ENCONTRADO) ====");
        return res.status(404).json({ message: "Appointment not found" });
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
        const hasCoords = Number.isFinite(a?.lat) && Number.isFinite(a?.lng);
        if (hasCoords) continue;

        const fullAddress = composeFullAddressFromAppointment(a);
        console.log("📍 [GEO] Geocodificando:", a.id, "=>", fullAddress);

        try {
          const { lat, lng } = await geocodeWithNominatim(fullAddress);

          // Salva no banco usando a camada de storage já existente
          await storage.updateAppointment(a.id, { lat, lng }, req.user.userId);
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
      const members = await storage.getTeamMembers(teamId, req.user.userId);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/team-members", authenticateToken, async (req: any, res) => {
    try {
      const memberData = insertTeamMemberSchema.parse(req.body);
      const member = await storage.addTeamMember(memberData, req.user.userId);
      res.json(member);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/team-members/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.removeTeamMember(id, req.user.userId);
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
      //    Usamos drizzle + sql para o date_trunc.
      const conditions: any[] = [
        eq(appointments.userId, req.user.userId),
        sql`date_trunc('day', ${appointments.scheduledDate}) = date_trunc('day', ${routeRow.date})`,
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

  const httpServer = createServer(app);
  return httpServer;
}