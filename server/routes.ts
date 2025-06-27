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

// Auth middleware
function authenticateToken(req: any, res: any, next: any) {
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
          detailedErrors.push(`Item ${i + 1}: Erro ao criar cliente "${clientData.name}" - ${error.message}`);
          processedItems.push({
            index: i + 1,
            status: 'error',
            error: error.message,
            data: clientData
          });
          console.log(`❌ Erro no cliente ${i + 1}: ${error.message}`);
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
      // Para atualização, aceitamos apenas campos básicos sem validações complexas
      const appointmentData = req.body;
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

  const httpServer = createServer(app);
  return httpServer;
}
