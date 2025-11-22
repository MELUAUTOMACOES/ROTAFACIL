import {
  type User, type InsertUser,
  type Client, type InsertClient,
  type Service, type InsertService,
  type Technician, type InsertTechnician,
  type Vehicle, type InsertVehicle,
  type Appointment, type InsertAppointment,
  type Checklist, type InsertChecklist,
  type BusinessRules, type InsertBusinessRules,
  type Team, type InsertTeam,
  type TeamMember, type InsertTeamMember,
  type AccessSchedule, type InsertAccessSchedule,
  type Company, type InsertCompany,
  type Membership, type InsertMembership,
  type Invitation, type InsertInvitation,
  type DateRestriction, type InsertDateRestriction,
  users, clients, services, technicians, vehicles, appointments, checklists, businessRules, teams, teamMembers, accessSchedules,
  companies, memberships, invitations,
  dateRestrictions,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  validateUser(email: string, password: string): Promise<User | null>;
  updateLastLogin(userId: number): Promise<void>;

  // User Management (Admin)
  getAllUsers(createdBy?: number): Promise<User[]>;
  createUserByAdmin(userData: any, adminId: number): Promise<User>;
  updateUserByAdmin(userId: number, userData: any): Promise<User>;
  deleteUser(userId: number): Promise<boolean>;
  setEmailVerificationToken(userId: number, token: string, expiry: Date): Promise<void>;
  verifyEmail(token: string): Promise<User | null>;
  updatePassword(userId: number, newPassword: string): Promise<void>;
  setRequirePasswordChange(userId: number, require: boolean): Promise<void>;

  // Clients
  getClients(userId: number): Promise<Client[]>;
  getClient(id: number, userId: number): Promise<Client | undefined>;
  getClientByCpf(cpf: string, userId: number): Promise<Client | undefined>;
  createClient(client: InsertClient, userId: number): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>, userId: number): Promise<Client>;
  deleteClient(id: number, userId: number): Promise<boolean>;
  searchClients(query: string, userId: number): Promise<Client[]>;

  // Services
  getServices(userId: number): Promise<Service[]>;
  getService(id: number, userId: number): Promise<Service | undefined>;
  createService(service: InsertService, userId: number): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>, userId: number): Promise<Service>;
  deleteService(id: number, userId: number): Promise<boolean>;

  // Technicians
  getTechnicians(userId: number): Promise<Technician[]>;
  getTechnician(id: number, userId: number): Promise<Technician | undefined>;
  createTechnician(technician: InsertTechnician, userId: number): Promise<Technician>;
  updateTechnician(id: number, technician: Partial<InsertTechnician>, userId: number): Promise<Technician>;
  deleteTechnician(id: number, userId: number): Promise<boolean>;

  // Vehicles
  getVehicles(userId: number): Promise<Vehicle[]>;
  getVehicle(id: number, userId: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle, userId: number): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>, userId: number): Promise<Vehicle>;
  deleteVehicle(id: number, userId: number): Promise<boolean>;

  // Appointments
  getAppointments(userId: number): Promise<Appointment[]>;
  getAppointment(id: number, userId: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment, userId: number): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>, userId: number): Promise<Appointment>;
  deleteAppointment(id: number, userId: number): Promise<boolean>;
  getAppointmentsByDate(date: string, userId: number): Promise<Appointment[]>;

  // Checklists
  getChecklists(userId: number): Promise<Checklist[]>;
  getChecklist(id: number, userId: number): Promise<Checklist | undefined>;
  createChecklist(checklist: InsertChecklist, userId: number): Promise<Checklist>;
  updateChecklist(id: number, checklist: Partial<InsertChecklist>, userId: number): Promise<Checklist>;
  deleteChecklist(id: number, userId: number): Promise<boolean>;

  // Business Rules
  getBusinessRules(userId: number): Promise<BusinessRules | undefined>;
  createBusinessRules(businessRules: InsertBusinessRules, userId: number): Promise<BusinessRules>;
  updateBusinessRules(id: number, businessRules: Partial<InsertBusinessRules>, userId: number): Promise<BusinessRules>;

  // Teams - Operações para equipes conforme solicitado
  getTeams(userId: number): Promise<Team[]>;
  getTeam(id: number, userId: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam, userId: number): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>, userId: number): Promise<Team>;
  deleteTeam(id: number, userId: number): Promise<boolean>;
  getTeamMembers(teamId: number, userId: number): Promise<TeamMember[]>;
  getAllTeamMembers(userId: number): Promise<TeamMember[]>;
  createTeamMember(teamMember: InsertTeamMember, userId: number): Promise<TeamMember>;
  deleteTeamMember(id: number, userId: number): Promise<boolean>;

  // Route optimization
  optimizeRoute(appointmentIds: number[], userId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }>;

  // Access Schedules
  getAccessSchedules(userId: number): Promise<AccessSchedule[]>;
  getAccessSchedule(id: number, userId: number): Promise<AccessSchedule | undefined>;
  getAccessScheduleById(id: number): Promise<AccessSchedule | undefined>; // Busca apenas por ID (para validação)
  createAccessSchedule(schedule: InsertAccessSchedule, userId: number): Promise<AccessSchedule>;
  updateAccessSchedule(id: number, schedule: Partial<InsertAccessSchedule>, userId: number): Promise<AccessSchedule>;
  deleteAccessSchedule(id: number, userId: number): Promise<boolean>;

  // Date Restrictions (feriados / indisponibilidades por técnico/equipe)
  getDateRestrictions(userId: number, start?: Date, end?: Date): Promise<DateRestriction[]>;
  createDateRestriction(data: InsertDateRestriction, userId: number): Promise<DateRestriction>;
  deleteDateRestriction(id: number, userId: number): Promise<boolean>;

  // Companies (Multiempresa)
  createCompany(company: InsertCompany): Promise<Company>;
  getCompanyById(id: number): Promise<Company | undefined>;
  getCompanyByCnpj(cnpj: string): Promise<Company | undefined>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company>;

  // Memberships
  createMembership(membership: InsertMembership): Promise<Membership>;
  getMembershipsByUserId(userId: number): Promise<Membership[]>;
  getMembershipsByCompanyId(companyId: number): Promise<Membership[]>;
  getMembership(userId: number, companyId: number): Promise<Membership | undefined>;
  updateMembershipRole(userId: number, companyId: number, role: string): Promise<Membership>;
  deleteMembership(userId: number, companyId: number): Promise<boolean>;

  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getInvitationsByCompanyId(companyId: number): Promise<Invitation[]>;
  updateInvitationStatus(id: number, status: string): Promise<Invitation>;
  deleteInvitation(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      return user;
    }
    return null;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user || undefined;
  }

  async updateLastLogin(userId: number): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }

  // User Management (Admin)
  async getAllUsers(createdBy?: number): Promise<User[]> {
    // Se createdBy for fornecido, filtrar apenas usuários criados por esse admin
    if (createdBy) {
      return await db.select().from(users).where(eq(users.createdBy, createdBy));
    }
    // Caso contrário, retornar todos (apenas para compatibilidade, não deve ser usado)
    return await db.select().from(users);
  }

  async createUserByAdmin(userData: any, adminId: number): Promise<User> {
    const tempPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const [user] = await db.insert(users).values({
      name: userData.name,
      email: userData.email,
      username: userData.username,
      password: hashedPassword,
      role: userData.role,
      plan: 'basic', // Plano sempre básico no cadastro
      phone: userData.phone || null,
      cep: userData.cep || null,
      logradouro: userData.logradouro || null,
      numero: userData.numero || null,
      complemento: userData.complemento || null,
      bairro: userData.bairro || null,
      cidade: userData.cidade || null,
      estado: userData.estado || null,
      emailVerified: false,
      requirePasswordChange: true,
      isActive: true,
      createdBy: adminId,
    }).returning();

    return user;
  }

  async updateUserByAdmin(userId: number, userData: any): Promise<User> {
    const [user] = await db.update(users)
      .set(userData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deleteUser(userId: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, userId));
    return (result.rowCount || 0) > 0;
  }

  async setEmailVerificationToken(userId: number, token: string, expiry: Date): Promise<void> {
    await db.update(users)
      .set({
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      })
      .where(eq(users.id, userId));
  }

  async verifyEmail(token: string): Promise<User | null> {
    const user = await this.getUserByVerificationToken(token);

    if (!user) {
      return null;
    }

    // Verificar se o token expirou
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      return null;
    }

    // Marcar email como verificado MAS MANTER O TOKEN
    // O token será limpo apenas após definir a senha em set-first-password
    const [updatedUser] = await db.update(users)
      .set({
        emailVerified: true,
        // NÃO limpar token aqui - ainda será necessário para definir senha
        // emailVerificationToken: null,
        // emailVerificationExpiry: null,
      })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser;
  }

  async updatePassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({
        password: hashedPassword,
        passwordChangedAt: new Date() // Registra quando senha foi alterada
      })
      .where(eq(users.id, userId));
  }

  async setRequirePasswordChange(userId: number, require: boolean): Promise<void> {
    await db.update(users)
      .set({ requirePasswordChange: require })
      .where(eq(users.id, userId));
  }

  // Password Reset
  async setPasswordResetToken(userId: number, token: string, expiry: Date): Promise<void> {
    await db.update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      })
      .where(eq(users.id, userId));
  }

  async getUserByPasswordResetToken(token: string): Promise<User | null> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.passwordResetToken, token));
    return user || null;
  }

  async resetPassword(token: string, newPassword: string): Promise<User | null> {
    const user = await this.getUserByPasswordResetToken(token);

    if (!user) {
      return null;
    }

    // Verificar se o token expirou
    if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
      return null;
    }

    // Atualizar senha, limpar token e registrar data de alteração
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [updatedUser] = await db.update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        passwordChangedAt: new Date(), // Registra quando senha foi alterada
        requirePasswordChange: false,
      })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser;
  }

  // Clients
  async getClients(userId: number): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.userId, userId));
  }

  async getClient(id: number, userId: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
    return client || undefined;
  }

  async getClientByCpf(cpf: string, userId: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.cpf, cpf), eq(clients.userId, userId)));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient, userId: number): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values({ ...insertClient, userId })
      .returning();
    return client;
  }

  async updateClient(id: number, clientData: Partial<InsertClient>, userId: number): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(clientData)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();
    return client;
  }

  async deleteClient(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async searchClients(query: string, userId: number): Promise<Client[]> {
    console.log("Busca cliente - input:", query);
    const searchTerm = `%${query}%`;

    const results = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.userId, userId),
          or(
            ilike(clients.name, searchTerm),
            ilike(clients.cpf, searchTerm)
          )
        )
      )
      .limit(5);

    console.log("Resultados encontrados:", results);
    return results;
  }

  // Services
  async getServices(userId: number): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.userId, userId));
  }

  async getService(id: number, userId: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(and(eq(services.id, id), eq(services.userId, userId)));
    return service || undefined;
  }

  async createService(insertService: InsertService, userId: number): Promise<Service> {
    const [service] = await db
      .insert(services)
      .values({ ...insertService, userId })
      .returning();
    return service;
  }

  async updateService(id: number, serviceData: Partial<InsertService>, userId: number): Promise<Service> {
    const [service] = await db
      .update(services)
      .set(serviceData)
      .where(and(eq(services.id, id), eq(services.userId, userId)))
      .returning();
    return service;
  }

  async deleteService(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(services)
      .where(and(eq(services.id, id), eq(services.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Technicians
  async getTechnicians(userId: number): Promise<Technician[]> {
    return await db.select().from(technicians).where(eq(technicians.userId, userId));
  }

  async getTechnician(id: number, userId: number): Promise<Technician | undefined> {
    const [technician] = await db.select().from(technicians).where(and(eq(technicians.id, id), eq(technicians.userId, userId)));
    return technician || undefined;
  }

  async createTechnician(insertTechnician: InsertTechnician, userId: number): Promise<Technician> {
    const [technician] = await db
      .insert(technicians)
      .values({ ...insertTechnician, userId })
      .returning();
    return technician;
  }

  async updateTechnician(id: number, technicianData: Partial<InsertTechnician>, userId: number): Promise<Technician> {
    const [technician] = await db
      .update(technicians)
      .set(technicianData)
      .where(and(eq(technicians.id, id), eq(technicians.userId, userId)))
      .returning();
    return technician;
  }

  async deleteTechnician(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(technicians)
      .where(and(eq(technicians.id, id), eq(technicians.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Vehicles
  async getVehicles(userId: number): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(eq(vehicles.userId, userId));
  }

  async getVehicle(id: number, userId: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
    return vehicle || undefined;
  }

  async createVehicle(insertVehicle: InsertVehicle, userId: number): Promise<Vehicle> {
    // 🔒 Validar unicidade: apenas 1 veículo por técnico/equipe
    if (insertVehicle.technicianId) {
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.technicianId, insertVehicle.technicianId),
            eq(vehicles.userId, userId)
          )
        )
        .limit(1);

      if (existing) {
        throw new Error(`Este técnico já está vinculado ao veículo: ${existing.plate}`);
      }
    }

    if (insertVehicle.teamId) {
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.teamId, insertVehicle.teamId),
            eq(vehicles.userId, userId)
          )
        )
        .limit(1);

      if (existing) {
        throw new Error(`Esta equipe já está vinculada ao veículo: ${existing.plate}`);
      }
    }

    const [vehicle] = await db
      .insert(vehicles)
      .values({ ...insertVehicle, userId })
      .returning();
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>, userId: number): Promise<Vehicle> {
    // 🔒 Validar unicidade: apenas 1 veículo por técnico/equipe
    if (vehicleData.technicianId) {
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.technicianId, vehicleData.technicianId),
            eq(vehicles.userId, userId)
          )
        )
        .limit(1);

      // Permitir se for o mesmo veículo sendo atualizado
      if (existing && existing.id !== id) {
        throw new Error(`Este técnico já está vinculado ao veículo: ${existing.plate}`);
      }
    }

    if (vehicleData.teamId) {
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.teamId, vehicleData.teamId),
            eq(vehicles.userId, userId)
          )
        )
        .limit(1);

      // Permitir se for o mesmo veículo sendo atualizado
      if (existing && existing.id !== id) {
        throw new Error(`Esta equipe já está vinculada ao veículo: ${existing.plate}`);
      }
    }

    const [vehicle] = await db
      .update(vehicles)
      .set(vehicleData)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
      .returning();
    return vehicle;
  }

  async deleteVehicle(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Appointments
  async getAppointments(userId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.userId, userId));
  }

  async getAppointment(id: number, userId: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.userId, userId)));
    return appointment || undefined;
  }

  async createAppointment(insertAppointment: InsertAppointment, userId: number): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values({ ...insertAppointment, userId })
      .returning();
    return appointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<InsertAppointment>, userId: number): Promise<Appointment> {
    console.log(`🔧 [STORAGE] Dados recebidos para atualização:`, appointmentData);

    // Processar scheduledDate se presente
    const processedData = { ...appointmentData };
    if (processedData.scheduledDate) {
      console.log(`📅 [STORAGE] Processando scheduledDate:`, processedData.scheduledDate);

      // Garantir que scheduledDate seja uma string ISO válida ou Date
      if (typeof processedData.scheduledDate === 'string') {
        // Verificar se é uma string ISO válida
        const dateTest = new Date(processedData.scheduledDate);
        if (isNaN(dateTest.getTime())) {
          throw new Error(`Data inválida no storage: ${processedData.scheduledDate}`);
        }
        // Converter para Date object para o Drizzle
        processedData.scheduledDate = dateTest;
        console.log(`✅ [STORAGE] String convertida para Date object`);
      } else if (!(processedData.scheduledDate instanceof Date)) {
        throw new Error(`Tipo de data inválido no storage: ${typeof processedData.scheduledDate}`);
      }
    }

    console.log(`🔄 [STORAGE] Dados processados:`, processedData);

    const [appointment] = await db
      .update(appointments)
      .set(processedData)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
      .returning();

    console.log(`✅ [STORAGE] Agendamento atualizado no banco: ${appointment.id}`);
    return appointment;
  }

  async deleteAppointment(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getAppointmentsByDate(date: string, userId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.userId, userId));
  }

  // Checklists
  async getChecklists(userId: number): Promise<Checklist[]> {
    return await db.select().from(checklists).where(eq(checklists.userId, userId));
  }

  async getChecklist(id: number, userId: number): Promise<Checklist | undefined> {
    const [checklist] = await db.select().from(checklists).where(and(eq(checklists.id, id), eq(checklists.userId, userId)));
    return checklist || undefined;
  }

  async createChecklist(insertChecklist: InsertChecklist, userId: number): Promise<Checklist> {
    const [checklist] = await db
      .insert(checklists)
      .values({ ...insertChecklist, userId })
      .returning();
    return checklist;
  }

  async updateChecklist(id: number, checklistData: Partial<InsertChecklist>, userId: number): Promise<Checklist> {
    const [checklist] = await db
      .update(checklists)
      .set(checklistData)
      .where(and(eq(checklists.id, id), eq(checklists.userId, userId)))
      .returning();
    return checklist;
  }

  async deleteChecklist(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(checklists)
      .where(and(eq(checklists.id, id), eq(checklists.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Business Rules
  async getBusinessRules(userId: number): Promise<BusinessRules | undefined> {
    const [rules] = await db.select().from(businessRules).where(eq(businessRules.userId, userId));
    return rules || undefined;
  }

  async createBusinessRules(insertBusinessRules: InsertBusinessRules, userId: number): Promise<BusinessRules> {
    const [rules] = await db
      .insert(businessRules)
      .values({ ...insertBusinessRules, userId })
      .returning();
    return rules;
  }

  async updateBusinessRules(id: number, rulesData: Partial<InsertBusinessRules>, userId: number): Promise<BusinessRules> {
    const [rules] = await db
      .update(businessRules)
      .set(rulesData)
      .where(and(eq(businessRules.id, id), eq(businessRules.userId, userId)))
      .returning();
    return rules;
  }

  // Route optimization
  async optimizeRoute(appointmentIds: number[], userId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }> {
    const allAppointments = await db.select().from(appointments).where(eq(appointments.userId, userId));
    const appointmentsList = allAppointments.filter(apt => appointmentIds.includes(apt.id));

    // Simple optimization - in production you'd implement actual routing algorithms
    return {
      optimizedOrder: appointmentsList,
      totalDistance: appointmentsList.length * 5, // Mock calculation
      estimatedTime: appointmentsList.length * 30 // Mock calculation
    };
  }

  // Teams - Implementação das operações de equipes conforme solicitado
  async getTeams(userId: number): Promise<Team[]> {
    return await db.select().from(teams).where(eq(teams.userId, userId));
  }

  async getTeam(id: number, userId: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(and(eq(teams.id, id), eq(teams.userId, userId)));
    return team || undefined;
  }

  async createTeam(insertTeam: InsertTeam, userId: number): Promise<Team> {
    const [team] = await db.insert(teams).values({ ...insertTeam, userId }).returning();
    return team;
  }

  async updateTeam(id: number, teamData: Partial<InsertTeam>, userId: number): Promise<Team> {
    const [team] = await db.update(teams)
      .set(teamData)
      .where(and(eq(teams.id, id), eq(teams.userId, userId)))
      .returning();
    return team;
  }

  async deleteTeam(id: number, userId: number): Promise<boolean> {
    // Remove membros da equipe primeiro
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, userId)));

    const result = await db.delete(teams).where(and(eq(teams.id, id), eq(teams.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getTeamMembers(teamId: number, userId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  }

  async getAllTeamMembers(userId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
  }

  async createTeamMember(insertTeamMember: InsertTeamMember, userId: number): Promise<TeamMember> {
    const [teamMember] = await db.insert(teamMembers).values({ ...insertTeamMember, userId }).returning();
    return teamMember;
  }

  async deleteTeamMember(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(teamMembers).where(and(eq(teamMembers.id, id), eq(teamMembers.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Access Schedules - Implementação para controle de horário de acesso
  async getAccessSchedules(userId: number): Promise<AccessSchedule[]> {
    // Filtrar por userId para garantir isolamento entre empresas/usuários
    return await db.select().from(accessSchedules).where(eq(accessSchedules.userId, userId));
  }

  async getAccessSchedule(id: number, userId: number): Promise<AccessSchedule | undefined> {
    // Buscar apenas por ID (userId ignorado para permitir que qualquer admin acesse)
    const [schedule] = await db.select().from(accessSchedules).where(eq(accessSchedules.id, id));
    return schedule || undefined;
  }

  // Busca tabela de horário apenas por ID (sem filtrar por userId)
  // Usado para validação de acesso de usuários que referenciam a tabela
  async getAccessScheduleById(id: number): Promise<AccessSchedule | undefined> {
    const [schedule] = await db.select().from(accessSchedules).where(eq(accessSchedules.id, id));
    return schedule || undefined;
  }

  async createAccessSchedule(insertSchedule: InsertAccessSchedule, userId: number): Promise<AccessSchedule> {
    const [schedule] = await db.insert(accessSchedules).values({ ...insertSchedule, userId }).returning();
    return schedule;
  }

  async updateAccessSchedule(id: number, scheduleData: Partial<InsertAccessSchedule>, userId: number): Promise<AccessSchedule> {
    // Atualizar apenas por ID (userId ignorado) para permitir edição por qualquer admin
    const [schedule] = await db.update(accessSchedules)
      .set(scheduleData)
      .where(eq(accessSchedules.id, id))
      .returning();
    return schedule;
  }

  async deleteAccessSchedule(id: number, userId: number): Promise<boolean> {
    // Antes de deletar, remover referências em usuários
    await db.update(users)
      .set({ accessScheduleId: null })
      .where(eq(users.accessScheduleId, id));

    // Remover tabela apenas por ID (userId ignorado) para permitir deleção por qualquer admin
    const result = await db.delete(accessSchedules).where(eq(accessSchedules.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Companies (Multiempresa)
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async getCompanyById(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.cnpj, cnpj));
    return company || undefined;
  }

  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company> {
    const [company] = await db.update(companies)
      .set(companyData)
      .where(eq(companies.id, id))
      .returning();
    return company;
  }

  // Memberships
  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const [membership] = await db.insert(memberships).values(insertMembership).returning();
    return membership;
  }

  async getMembershipsByUserId(userId: number): Promise<Membership[]> {
    return await db.select().from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.isActive, true)));
  }

  async getMembershipsByCompanyId(companyId: number): Promise<Membership[]> {
    return await db.select().from(memberships)
      .where(and(eq(memberships.companyId, companyId), eq(memberships.isActive, true)));
  }

  async getMembership(userId: number, companyId: number): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships)
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.isActive, true)
      ));
    return membership || undefined;
  }

  async updateMembershipRole(userId: number, companyId: number, role: string): Promise<Membership> {
    const [membership] = await db.update(memberships)
      .set({ role })
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId)
      ))
      .returning();
    return membership;
  }

  async deleteMembership(userId: number, companyId: number): Promise<boolean> {
    const result = await db.delete(memberships)
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId)
      ));
    return (result.rowCount || 0) > 0;
  }

  // Date Restrictions (feriados / indisponibilidades por técnico/equipe)
  async getDateRestrictions(userId: number, start?: Date, end?: Date): Promise<DateRestriction[]> {
    const baseWhere = eq(dateRestrictions.userId, userId);

    if (!start && !end) {
      return await db.select().from(dateRestrictions).where(baseWhere);
    }

    const conditions: any[] = [baseWhere];

    if (start) {
      const startOfDay = new Date(start);
      startOfDay.setHours(0, 0, 0, 0);
      conditions.push(sql`${dateRestrictions.date} >= ${startOfDay.toISOString()}`);
    }

    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(sql`${dateRestrictions.date} <= ${endOfDay.toISOString()}`);
    }

    return await db.select().from(dateRestrictions).where(and(...conditions));
  }

  async createDateRestriction(insertRestriction: InsertDateRestriction, userId: number): Promise<DateRestriction> {
    const [restriction] = await db
      .insert(dateRestrictions)
      .values({ ...insertRestriction, userId })
      .returning();
    return restriction;
  }

  async deleteDateRestriction(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(dateRestrictions)
      .where(and(eq(dateRestrictions.id, id), eq(dateRestrictions.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Invitations
  async createInvitation(insertInvitation: InsertInvitation): Promise<Invitation> {
    const [invitation] = await db.insert(invitations).values(insertInvitation).returning();
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [invitation] = await db.select().from(invitations)
      .where(eq(invitations.token, token));
    return invitation || undefined;
  }

  async getInvitationsByCompanyId(companyId: number): Promise<Invitation[]> {
    return await db.select().from(invitations)
      .where(eq(invitations.companyId, companyId));
  }

  async updateInvitationStatus(id: number, status: string): Promise<Invitation> {
    const [invitation] = await db.update(invitations)
      .set({ status })
      .where(eq(invitations.id, id))
      .returning();
    return invitation;
  }

  async deleteInvitation(id: number): Promise<boolean> {
    const result = await db.delete(invitations).where(eq(invitations.id, id));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();