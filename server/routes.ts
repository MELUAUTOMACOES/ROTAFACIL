import type { Express } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
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

export async function registerRoutes(app: Express): Promise<Server> {
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
      const clientData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(id, clientData, req.user.userId);
      res.json(client);
    } catch (error: any) {
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
    try {
      const technicianData = insertTechnicianSchema.parse(req.body);
      const technician = await storage.createTechnician(technicianData, req.user.userId);
      res.json(technician);
    } catch (error: any) {
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
    try {
      const id = parseInt(req.params.id);
      const appointmentData = req.body;

      // (repete o tratamento do campo scheduledDate, igual ao PUT)
      if (appointmentData.scheduledDate) {
        if (typeof appointmentData.scheduledDate === 'string') {
          // ok
        } else if (appointmentData.scheduledDate instanceof Date) {
          appointmentData.scheduledDate = appointmentData.scheduledDate.toISOString();
        } else {
          try {
            const dateObj = new Date(appointmentData.scheduledDate);
            if (isNaN(dateObj.getTime())) {
              throw new Error(`Data inválida: ${appointmentData.scheduledDate}`);
            }
            appointmentData.scheduledDate = dateObj.toISOString();
          } catch (dateError) {
            return res.status(400).json({ message: `Data inválida: ${appointmentData.scheduledDate}` });
          }
        }
      }

      const appointment = await storage.updateAppointment(id, appointmentData, req.user.userId);
      res.json(appointment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/appointments/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAppointment(id, req.user.userId);
      if (!success) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.json({ message: "Appointment deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
  
  // Novo endpoint: Otimização TSP com OSRM
  app.get("/api/optimize-trip", async (req, res) => {
    try {
      const coords = req.query.coords as string;
      if (!coords) {
        return res.status(400).json({ error: "Missing 'coords' parameter" });
      }

      // Validar que temos pelo menos dois pontos
      const coordArray = coords.split(';');
      if (coordArray.length < 2) {
        return res.status(400).json({ error: "São necessárias pelo menos 2 coordenadas para otimizar uma rota" });
      }

      // Validar formato das coordenadas
      for (const coord of coordArray) {
        const parts = coord.split(',');
        if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) {
          return res.status(400).json({ error: `Formato de coordenada inválido: ${coord}. Use formato: longitude,latitude` });
        }
      }

      // Usar o endereço do OSRM
      const OSRM_URL = getOsrmUrl()?.replace(/\/$/, '') || null;
      if (!OSRM_URL) {
        return res.status(500).json({ error: "Endereço OSRM não configurado. Crie/atualize o arquivo osrm_url.txt." });
      }
      
      const osrmUrl = `${OSRM_URL}/trip/v1/driving/${coords}?source=first&destination=last&roundtrip=false&overview=full&geometries=geojson`;
      console.log("🎯 Chamando OSRM TSP:", osrmUrl);
      console.log("📍 Coordenadas para otimização:", coordArray.length, "pontos");
      
      const osrmRes = await fetch(osrmUrl, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });
      
      if (!osrmRes.ok) {
        const text = await osrmRes.text();
        console.error("❌ Erro OSRM TSP:", text);
        return res.status(500).json({ error: `OSRM TSP error: ${text.substring(0, 300)}` });
      }
      
      const data = await osrmRes.json();
      console.log("✅ Rota otimizada OSRM TSP calculada com sucesso");
      console.log("🔄 Waypoints otimizados:", data.waypoints?.length || 0, "pontos");
      return res.json(data);
    } catch (err) {
      console.error("❌ Erro no proxy OSRM TSP:", err);
      return res.status(500).json({ error: "Erro no proxy OSRM TSP" });
    }
  });

  app.get("/api/route", async (req, res) => {
    try {
      const coords = req.query.coords as string;
      if (!coords) {
        return res.status(400).json({ error: "Missing 'coords' parameter" });
      }

      // Validar que temos pelo menos dois pontos
      const coordArray = coords.split(';');
      if (coordArray.length < 2) {
        return res.status(400).json({ error: "São necessárias pelo menos 2 coordenadas para calcular uma rota" });
      }

      // Validar formato das coordenadas
      for (const coord of coordArray) {
        const parts = coord.split(',');
        if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) {
          return res.status(400).json({ error: `Formato de coordenada inválido: ${coord}. Use formato: longitude,latitude` });
        }
      }

      // Usa o endereço da variável de ambiente, SEM barra no final!
      const OSRM_URL = getOsrmUrl()?.replace(/\/$/, '') || null;
      if (!OSRM_URL) {
        return res.status(500).json({ error: "Endereço OSRM não configurado. Crie/atualize o arquivo osrm_url.txt." });
      }
      
      const osrmUrl = `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      console.log("🌐 Chamando OSRM:", osrmUrl);
      console.log("📍 Coordenadas validadas:", coordArray.length, "pontos");
      
      const osrmRes = await fetch(osrmUrl, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });
      if (!osrmRes.ok) {
        const text = await osrmRes.text();
        console.error("❌ Erro OSRM:", text);
        return res.status(500).json({ error: `OSRM error: ${text.substring(0, 300)}` });
      }
      const data = await osrmRes.json();
      console.log("✅ Rota OSRM calculada com sucesso");
      return res.json(data);
    } catch (err) {
      console.error("❌ Erro no proxy OSRM:", err);
      return res.status(500).json({ error: "Erro no proxy OSRM" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
