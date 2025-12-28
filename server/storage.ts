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
  type Route,
  type AuditLog, type InsertAuditLog,
  type VehicleDocument, type InsertVehicleDocument,
  type VehicleMaintenance, type InsertVehicleMaintenance,
  type MaintenanceWarranty, type InsertMaintenanceWarranty,
  type FeatureUsage, type InsertFeatureUsage,
  type AppointmentHistory, type InsertAppointmentHistory,
  type FuelRecord, type InsertFuelRecord,
  users, clients, services, technicians, vehicles, appointments, appointmentHistory, checklists, businessRules, teams, teamMembers, accessSchedules,
  companies, memberships, invitations,
  dateRestrictions,
  routes, routeStops,
  type RouteStop,
  auditLogs,
  vehicleDocuments, vehicleMaintenances, maintenanceWarranties,
  featureUsage,
  trackingLocations,
  fuelRecords
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql, inArray, isNotNull, ne, isNull, gte, lte, desc } from "drizzle-orm";
import { format } from "date-fns";
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
  getAllClients(userId: number): Promise<Client[]>;
  getClients(userId: number, page?: number, limit?: number): Promise<{ data: Client[], total: number }>;
  getClient(id: number, userId: number): Promise<Client | undefined>;
  getClientByCpf(cpf: string, userId: number): Promise<Client | undefined>;
  createClient(client: InsertClient, userId: number): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>, userId: number): Promise<Client>;
  deleteClient(id: number, userId: number): Promise<boolean>;
  searchClients(query: string, userId: number, page?: number, limit?: number): Promise<{ data: Client[], total: number }>;

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
  updateInvitationStatus(id: number, status: string): Promise<Invitation>;
  deleteInvitation(id: number): Promise<boolean>;

  // Provider Flow
  getProviderActiveRoute(userId: number, date: Date): Promise<Route | undefined>;
  updateAppointmentExecution(id: number, data: {
    status?: string;
    feedback?: string | null;
    photos?: string[] | null;
    signature?: string | null;
    executionStatus?: string | null;
    executionNotes?: string | null;
    executionStartedAt?: string | null;
    executionFinishedAt?: string | null;
    executionStartLocation?: any;
    executionEndLocation?: any;
  }, userId: number): Promise<Appointment>;
  finalizeRoute(id: string, status: string, userId: number): Promise<Route>;
  updateRouteDate(id: string, date: Date, userId: number): Promise<Route>;
  getRouteStops(routeId: string): Promise<RouteStop[]>;
  getPendingAppointments(userId: number): Promise<any[]>;
  getAppointmentHistory(appointmentId: number): Promise<AppointmentHistory[]>;
  createAppointmentHistory(data: InsertAppointmentHistory, changedBy: number, ownerId: number): Promise<AppointmentHistory>;

  // Vehicle Documents
  getVehicleDocuments(vehicleId: number, userId: number): Promise<VehicleDocument[]>;
  createVehicleDocument(document: InsertVehicleDocument, userId: number): Promise<VehicleDocument>;
  deleteVehicleDocument(id: number, userId: number): Promise<boolean>;

  // Vehicle Maintenances
  getVehicleMaintenances(vehicleId: number, userId: number): Promise<VehicleMaintenance[]>;
  getVehicleMaintenance(id: number, userId: number): Promise<VehicleMaintenance | undefined>;
  createVehicleMaintenance(maintenance: InsertVehicleMaintenance, userId: number): Promise<VehicleMaintenance>;
  updateVehicleMaintenance(id: number, data: Partial<InsertVehicleMaintenance>, userId: number): Promise<VehicleMaintenance>;
  deleteVehicleMaintenance(id: number, userId: number): Promise<boolean>;

  // Maintenance Warranties
  getMaintenanceWarranties(maintenanceId: number): Promise<MaintenanceWarranty[]>;
  createMaintenanceWarranty(warranty: InsertMaintenanceWarranty): Promise<MaintenanceWarranty>;
  deleteMaintenanceWarranty(id: number): Promise<boolean>;

  // Feature Usage (Metrics)
  createFeatureUsage(data: InsertFeatureUsage): Promise<FeatureUsage>;
  getFeatureUsageByPeriod(startDate: Date, endDate: Date): Promise<FeatureUsage[]>;
  getTopFeatures(limit: number, startDate?: Date, endDate?: Date): Promise<{ feature: string; action: string; count: number }[]>;
  getUsersActivityByDay(startDate: Date, endDate: Date): Promise<{ date: string; activeUsers: number; totalActions: number }[]>;
  getMetricsOverview(): Promise<{ totalUsers: number; totalCompanies: number; totalActionsToday: number; totalActionsWeek: number }>;

  // Tracking Locations
  createTrackingLocation(data: { userId: number; routeId?: string; latitude: number; longitude: number; accuracy?: number; batteryLevel?: number; speed?: number; heading?: number; providerId?: number }): Promise<any>;
  getRouteTrackingLocations(routeId: string): Promise<any[]>;

  // Fuel Records
  getFuelRecords(userId: number, filters?: { vehicleId?: number; startDate?: Date; endDate?: Date }): Promise<FuelRecord[]>;
  createFuelRecord(record: InsertFuelRecord, userId: number, companyId?: number | null): Promise<FuelRecord>;
  getVehicleFuelStats(vehicleId: number, userId: number): Promise<{ totalLiters: number; totalCost: number; avgPricePerLiter: number; recordCount: number }>;
  getFleetFuelStats(userId: number, filters?: { vehicleIds?: number[]; fuelTypes?: string[] }): Promise<{
    totalSpent: number;
    totalLiters: number;
    avgPricePerLiter: number;
    costPerKm: number;
    avgKmPerLiter: number;
    totalRefuelings: number;
    spentVariation: number;
    litersVariation: number;
    byVehicle: { vehicleId: number; plate: string; model: string; totalSpent: number; totalLiters: number; kmPerLiter: number }[];
    monthlyEvolution: { month: string; totalSpent: number; totalLiters: number }[];
  }>;

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

  async updateRouteDate(id: string, date: Date, userId: number): Promise<Route> {
    const [route] = await db
      .update(routes)
      .set({ date, updatedAt: new Date() })
      .where(and(eq(routes.id, id), eq(routes.userId, userId))) // Garante isolamento
      .returning();
    return route;
  }

  async getAppointmentHistory(appointmentId: number): Promise<AppointmentHistory[]> {
    return db.select()
      .from(appointmentHistory)
      .where(eq(appointmentHistory.appointmentId, appointmentId))
      .orderBy(desc(appointmentHistory.changedAt));
  }

  async createAppointmentHistory(data: InsertAppointmentHistory, changedBy: number, ownerId: number): Promise<AppointmentHistory> {
    const [history] = await db.insert(appointmentHistory).values({
      appointmentId: data.appointmentId,
      changedBy: changedBy,
      changedByName: data.changedByName,
      changeType: data.changeType,
      reason: data.reason,
      previousData: data.previousData,
      newData: data.newData,
      userId: ownerId, // Dono do dado
      notes: data.notes
    }).returning();
    return history;
  }

  // Clients
  async getAllClients(userId: number): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(sql`${clients.createdAt} DESC`);
  }

  async getClients(userId: number, page: number = 1, limit: number = 20): Promise<{ data: Client[], total: number }> {
    const offset = (page - 1) * limit;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.userId, userId));

    const total = Number(countResult?.count || 0);

    const data = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(sql`${clients.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return { data, total };
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

  async searchClients(query: string, userId: number, page: number = 1, limit: number = 20): Promise<{ data: Client[], total: number }> {
    console.log("Busca cliente - input:", query);
    const searchTerm = `%${query}%`;

    // Tenta limpar a query para ver se é apenas números (busca por CPF)
    const numericQuery = query.replace(/\D/g, '');
    const isCpfSearch = numericQuery.length > 0;

    let whereClause;

    if (isCpfSearch) {
      whereClause = and(
        eq(clients.userId, userId),
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.cpf, searchTerm),
          sql`regexp_replace(${clients.cpf}, '\\D', '', 'g') LIKE ${`%${numericQuery}%`}`
        )
      );
    } else {
      whereClause = and(
        eq(clients.userId, userId),
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.cpf, searchTerm)
        )
      );
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const data = await db
      .select()
      .from(clients)
      .where(whereClause)
      .orderBy(sql`${clients.createdAt} DESC`)
      .limit(limit)
      .offset((page - 1) * limit);

    console.log(`Resultados encontrados para "${query}":`, total);
    return { data, total };
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
      .values({ ...insertVehicle, userId } as any)
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
      .set(vehicleData as any)
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
    // Processar scheduledDate se presente
    const processedData = { ...appointmentData };
    if (processedData.scheduledDate) {
      // Garantir que scheduledDate seja uma string ISO válida ou Date
      if (typeof processedData.scheduledDate === 'string') {
        // Verificar se é uma string ISO válida
        const dateTest = new Date(processedData.scheduledDate);
        if (isNaN(dateTest.getTime())) {
          throw new Error(`Data inválida no storage: ${processedData.scheduledDate}`);
        }
        // Converter para Date object para o Drizzle
        processedData.scheduledDate = dateTest;
      } else if (!(processedData.scheduledDate instanceof Date)) {
        throw new Error(`Tipo de data inválido no storage: ${typeof processedData.scheduledDate}`);
      }
    }

    const [appointment] = await db
      .update(appointments)
      .set(processedData)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
      .returning();

    return appointment;
  }

  async deleteAppointment(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getAppointmentsByDate(date: string, userId: number): Promise<Appointment[]> {
    // Converter string de data para range do dia inteiro
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select()
      .from(appointments)
      .where(and(
        eq(appointments.userId, userId),
        gte(appointments.scheduledDate, startOfDay),
        lte(appointments.scheduledDate, endOfDay)
      ));
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
      .values({ ...insertBusinessRules, userId } as any)
      .returning();
    return rules;
  }

  async updateBusinessRules(id: number, rulesData: Partial<InsertBusinessRules>, userId: number): Promise<BusinessRules> {
    const [rules] = await db
      .update(businessRules)
      .set(rulesData as any)
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

  // Provider Flow Implementation
  async getProviderActiveRoute(userId: number, date: Date): Promise<Route | undefined> {
    // 1. Buscar rotas onde o usuário é o responsável direto (technician)
    // OU onde o usuário faz parte da equipe responsável (team)

    // Normalizar data para início e fim do dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Buscar técnico associado ao usuário
    const [tech] = await db.select().from(technicians).where(eq(technicians.userId, userId));

    // Buscar equipes que o usuário faz parte
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const teamIds = userTeams.map(t => t.teamId);

    // Construir query
    const conditions = [
      and(
        // Comparar Apenas a DATA (ignorando hora/timezone)
        sql`DATE(${routes.date}) = DATE(${format(date, "yyyy-MM-dd")})`,

        // Status confirmado, em andamento ou in_progress (legado)
        or(eq(routes.status, 'confirmado'), eq(routes.status, 'em_andamento'), eq(routes.status, 'in_progress')),
        // Responsável
        or(
          // Caso 1: Responsável é o técnico (usuário logado)
          and(
            eq(routes.responsibleType, 'technician'),
            eq(routes.responsibleId, String(tech?.id || 0)) // tech.id pode ser undefined se usuário não for técnico
          ),
          // Caso 2: Responsável é uma equipe que o usuário faz parte
          and(
            eq(routes.responsibleType, 'team'),
            inArray(routes.responsibleId, teamIds.map(String))
          )
        )
      )
    ];

    // Se não tiver técnico nem equipes, retorna undefined direto (exceto se for admin, mas aqui focamos no fluxo de prestador)
    if (!tech && teamIds.length === 0) {
      return undefined;
    }

    const [route] = await db
      .select()
      .from(routes)
      .where(and(...conditions))
      .orderBy(desc(routes.updatedAt)) // 🆕 Preferir a rota modificada mais recentemente (ex: iniciada)
      .limit(1);

    return route || undefined;
  }

  async updateAppointmentExecution(
    id: number,
    data: {
      status?: string;
      feedback?: string | null;
      photos?: string[] | null;
      signature?: string | null;
      executionStatus?: string | null;
      executionNotes?: string | null;
      executionStartedAt?: string | null;
      executionFinishedAt?: string | null;
      executionStartLocation?: any;
      executionEndLocation?: any;
      paymentStatus?: string | null;       // 💵 'pago' | 'nao_pago'
      paymentNotes?: string | null;        // 💵 Motivo se não pagou
      paymentConfirmedAt?: string | null;  // 💵 Quando foi confirmado
    },
    userId: number
  ): Promise<Appointment> {
    // Validar se o usuário tem permissão para editar esse agendamento
    // (Idealmente verificar se ele é o dono da rota, mas por simplificação vamos confiar no userId do contexto e na existência do agendamento)

    // Preparar objeto de atualização
    const updateData: any = { ...data };

    if (data.executionStartedAt) updateData.executionStartedAt = new Date(data.executionStartedAt);
    if (data.executionFinishedAt) updateData.executionFinishedAt = new Date(data.executionFinishedAt);
    if (data.paymentConfirmedAt) updateData.paymentConfirmedAt = new Date(data.paymentConfirmedAt);

    // Salvar histórico antes de atualizar
    const [currentAppointment] = await db.select().from(appointments).where(eq(appointments.id, id));

    if (currentAppointment) {
      // Dummy object para satisfazer o type InsertAppointmentHistory que exige changedBy
      // mas será sobrescrito pelo argumento explicito
      const historyData: any = {
        appointmentId: id,
        changedByName: "Prestador (App)",
        changedBy: userId, // Satisfazendo Zod schema type, embora createAppointmentHistory use o argumento explicito
        changeType: "execution_update",
        reason: "Atualização de status/execução pelo prestador",
        previousData: currentAppointment,
        newData: updateData
      };

      await this.createAppointmentHistory(historyData, userId, currentAppointment.userId);
    }

    const [updated] = await db
      .update(appointments)
      .set(updateData)
      .where(eq(appointments.id, id))
      .returning();

    return updated;
  }

  async getPendingAppointments(userId: number): Promise<any[]> {
    // Buscar agendamentos de rotas finalizadas que não foram concluídos

    // 1. Buscar rotas finalizadas (incluindo rotas antigas sem userId para compatibilidade)
    const finalizedRoutes = await db
      .select({ id: routes.id, status: routes.status, title: routes.title, date: routes.date })
      .from(routes)
      .where(and(
        or(eq(routes.userId, userId), isNull(routes.userId)), // Aceita rotas do usuário OU rotas sem userId (legado)
        or(eq(routes.status, 'finalizado'), eq(routes.status, 'cancelado'), eq(routes.status, 'incompleto'))
      ))
      .orderBy(sql`${routes.date} DESC`); // Ordenar por data

    const routeIds = finalizedRoutes.map(r => r.id);

    if (routeIds.length === 0) {
      return [];
    }

    // 2. Buscar routeStops dessas rotas
    const stops = await db
      .select()
      .from(routeStops)
      .where(inArray(routeStops.routeId, routeIds));

    const appointmentIds = stops
      .map(s => s.appointmentNumericId)
      .filter((id): id is number => id !== null);

    if (appointmentIds.length === 0) {
      return [];
    }

    // 3. Buscar agendamentos pendentes (não concluídos, não cancelados, OU com pagamento não realizado)
    const pendingAppointments = await db
      .select()
      .from(appointments)
      .where(and(
        inArray(appointments.id, appointmentIds),
        ne(appointments.status, 'cancelled'), // Exclui agendamentos cancelados
        or(
          // Não concluídos
          and(
            or(isNull(appointments.executionStatus), ne(appointments.executionStatus, 'concluido'))
          ),
          // OU com pagamento pendente (paymentStatus = 'nao_pago')
          eq(appointments.paymentStatus, 'nao_pago')
        )
      ));

    // 4. 🚀 OTIMIZADO: Buscar TODOS os dados relacionados de uma vez (batch)
    const clientIds = Array.from(new Set(pendingAppointments.map(a => a.clientId).filter((id): id is number => id !== null)));
    const serviceIds = Array.from(new Set(pendingAppointments.map(a => a.serviceId)));
    const technicianIds = Array.from(new Set(pendingAppointments.map(a => a.technicianId).filter((id): id is number => id !== null)));
    const teamIds = Array.from(new Set(pendingAppointments.map(a => a.teamId).filter((id): id is number => id !== null)));

    // Buscar todos de uma vez
    const [allClients, allServices, allTechnicians, allTeams] = await Promise.all([
      clientIds.length > 0 ? db.select().from(clients).where(and(inArray(clients.id, clientIds), eq(clients.userId, userId))) : Promise.resolve([]),
      serviceIds.length > 0 ? db.select().from(services).where(and(inArray(services.id, serviceIds), eq(services.userId, userId))) : Promise.resolve([]),
      technicianIds.length > 0 ? db.select().from(technicians).where(and(inArray(technicians.id, technicianIds), eq(technicians.userId, userId))) : Promise.resolve([]),
      teamIds.length > 0 ? db.select().from(teams).where(and(inArray(teams.id, teamIds), eq(teams.userId, userId))) : Promise.resolve([]),
    ]);

    // Criar maps para lookup rápido
    const clientsMap = new Map(allClients.map(c => [c.id, c]));
    const servicesMap = new Map(allServices.map(s => [s.id, s]));
    const techniciansMap = new Map(allTechnicians.map(t => [t.id, t]));
    const teamsMap = new Map(allTeams.map(t => [t.id, t]));

    // 5. Enriquecer com dados (agora é apenas lookup, não query)
    const result = pendingAppointments.map((apt) => {
      const stop = stops.find(s => s.appointmentNumericId === apt.id);
      const route = finalizedRoutes.find(r => r.id === stop!.routeId);
      const client = apt.clientId ? clientsMap.get(apt.clientId) : undefined;
      const service = servicesMap.get(apt.serviceId);
      const technician = apt.technicianId ? techniciansMap.get(apt.technicianId) : null;
      const team = apt.teamId ? teamsMap.get(apt.teamId) : null;

      return {
        ...apt,
        routeDate: route?.date,
        routeTitle: route?.title,
        clientName: client?.name,
        serviceName: service?.name,
        responsibleName: technician?.name || team?.name || 'N/A'
      };
    });

    // 6. Ordenar resultado final por data da rota (mais recente primeiro)
    return result.sort((a, b) => {
      const dateA = a.routeDate ? new Date(a.routeDate).getTime() : 0;
      const dateB = b.routeDate ? new Date(b.routeDate).getTime() : 0;
      return dateB - dateA; // DESC
    });
  }

  async finalizeRoute(id: string, status: string, userId: number): Promise<Route> {
    const [route] = await db
      .update(routes)
      .set({ status })
      .where(eq(routes.id, id))
      .returning();

    return route;
  }

  async getRouteStops(routeId: string): Promise<RouteStop[]> {
    return await db.select().from(routeStops).where(eq(routeStops.routeId, routeId)).orderBy(routeStops.order);
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

  // 🔐 Audit Logging - Registro de ações para segurança
  async logAudit(data: {
    userId?: number;
    action: string; // login, logout, create, update, delete, view
    resource: string; // appointment, client, route, user, etc.
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values({
      userId: data.userId || null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    }).returning();
    return log;
  }

  async getAuditLogs(filters?: {
    userId?: number;
    action?: string;
    resource?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.resource) {
      conditions.push(eq(auditLogs.resource, filters.resource));
    }

    const query = db.select().from(auditLogs);

    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(sql`${auditLogs.createdAt} DESC`).limit(filters?.limit || 100);
    }

    return await query.orderBy(sql`${auditLogs.createdAt} DESC`).limit(filters?.limit || 100);
  }

  // Vehicle Documents
  async getVehicleDocuments(vehicleId: number, userId: number): Promise<VehicleDocument[]> {
    return await db
      .select()
      .from(vehicleDocuments)
      .where(and(eq(vehicleDocuments.vehicleId, vehicleId), eq(vehicleDocuments.userId, userId)))
      .orderBy(sql`${vehicleDocuments.createdAt} DESC`);
  }

  async createVehicleDocument(document: InsertVehicleDocument, userId: number): Promise<VehicleDocument> {
    const [doc] = await db
      .insert(vehicleDocuments)
      .values({ ...document, userId })
      .returning();
    return doc;
  }

  async deleteVehicleDocument(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(vehicleDocuments)
      .where(and(eq(vehicleDocuments.id, id), eq(vehicleDocuments.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Vehicle Maintenances
  async getVehicleMaintenances(vehicleId: number, userId: number): Promise<VehicleMaintenance[]> {
    return await db
      .select()
      .from(vehicleMaintenances)
      .where(and(eq(vehicleMaintenances.vehicleId, vehicleId), eq(vehicleMaintenances.userId, userId)))
      .orderBy(sql`${vehicleMaintenances.entryDate} DESC`);
  }

  async getVehicleMaintenance(id: number, userId: number): Promise<VehicleMaintenance | undefined> {
    const [maintenance] = await db
      .select()
      .from(vehicleMaintenances)
      .where(and(eq(vehicleMaintenances.id, id), eq(vehicleMaintenances.userId, userId)));
    return maintenance || undefined;
  }

  async createVehicleMaintenance(maintenance: InsertVehicleMaintenance, userId: number): Promise<VehicleMaintenance> {
    // Calcular totalCost automaticamente
    const laborCost = parseFloat(String(maintenance.laborCost || 0));
    const materialsCost = parseFloat(String(maintenance.materialsCost || 0));
    const totalCost = (laborCost + materialsCost).toFixed(2);

    const [created] = await db
      .insert(vehicleMaintenances)
      .values({
        vehicleId: maintenance.vehicleId,
        entryDate: maintenance.entryDate,
        exitDate: maintenance.exitDate,
        workshop: maintenance.workshop,
        technicianResponsible: maintenance.technicianResponsible,
        description: maintenance.description,
        category: maintenance.category,
        maintenanceType: maintenance.maintenanceType,
        vehicleKm: maintenance.vehicleKm,
        photos: maintenance.photos,
        laborCost: laborCost.toFixed(2),
        materialsCost: materialsCost.toFixed(2),
        totalCost,
        vehicleUnavailable: maintenance.vehicleUnavailable,
        unavailableDays: maintenance.unavailableDays,
        affectedAppointments: maintenance.affectedAppointments,
        invoiceNumber: maintenance.invoiceNumber,
        observations: maintenance.observations,
        status: maintenance.status || "concluida",
        scheduledDate: maintenance.scheduledDate,
        userId,
        updatedAt: new Date()
      })
      .returning();
    return created;
  }

  async updateVehicleMaintenance(id: number, data: Partial<InsertVehicleMaintenance>, userId: number): Promise<VehicleMaintenance> {
    // Recalcular totalCost se laborCost ou materialsCost foram alterados
    let updateData: any = { ...data, updatedAt: new Date() };

    if (data.laborCost !== undefined || data.materialsCost !== undefined) {
      // Buscar registro atual para pegar valores não alterados
      const current = await this.getVehicleMaintenance(id, userId);
      if (current) {
        const laborCost = parseFloat(String(data.laborCost ?? current.laborCost ?? 0));
        const materialsCost = parseFloat(String(data.materialsCost ?? current.materialsCost ?? 0));
        updateData.totalCost = (laborCost + materialsCost).toFixed(2);
      }
    }

    const [updated] = await db
      .update(vehicleMaintenances)
      .set(updateData)
      .where(and(eq(vehicleMaintenances.id, id), eq(vehicleMaintenances.userId, userId)))
      .returning();
    return updated;
  }

  async deleteVehicleMaintenance(id: number, userId: number): Promise<boolean> {
    // Cascade delete de warranties é automático pela FK
    const result = await db
      .delete(vehicleMaintenances)
      .where(and(eq(vehicleMaintenances.id, id), eq(vehicleMaintenances.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  // Maintenance Warranties
  async getMaintenanceWarranties(maintenanceId: number): Promise<MaintenanceWarranty[]> {
    return await db
      .select()
      .from(maintenanceWarranties)
      .where(eq(maintenanceWarranties.maintenanceId, maintenanceId))
      .orderBy(sql`${maintenanceWarranties.warrantyExpiration} ASC`);
  }

  async createMaintenanceWarranty(warranty: InsertMaintenanceWarranty): Promise<MaintenanceWarranty> {
    const [created] = await db
      .insert(maintenanceWarranties)
      .values(warranty)
      .returning();
    return created;
  }

  async deleteMaintenanceWarranty(id: number): Promise<boolean> {
    const result = await db
      .delete(maintenanceWarranties)
      .where(eq(maintenanceWarranties.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Feature Usage (Metrics)
  async createFeatureUsage(data: InsertFeatureUsage): Promise<FeatureUsage> {
    const [created] = await db
      .insert(featureUsage)
      .values(data)
      .returning();
    return created;
  }

  async getFeatureUsageByPeriod(startDate: Date, endDate: Date): Promise<FeatureUsage[]> {
    return await db
      .select()
      .from(featureUsage)
      .where(
        and(
          sql`${featureUsage.createdAt} >= ${startDate}`,
          sql`${featureUsage.createdAt} <= ${endDate}`
        )
      )
      .orderBy(sql`${featureUsage.createdAt} DESC`);
  }

  async getTopFeatures(limit: number, startDate?: Date, endDate?: Date): Promise<{ feature: string; action: string; count: number }[]> {
    let query = db
      .select({
        feature: featureUsage.feature,
        action: featureUsage.action,
        count: sql<number>`count(*)::int`,
      })
      .from(featureUsage);

    if (startDate && endDate) {
      query = query.where(
        and(
          sql`${featureUsage.createdAt} >= ${startDate}`,
          sql`${featureUsage.createdAt} <= ${endDate}`
        )
      ) as typeof query;
    }

    const results = await query
      .groupBy(featureUsage.feature, featureUsage.action)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);

    return results;
  }

  async getUsersActivityByDay(startDate: Date, endDate: Date): Promise<{ date: string; activeUsers: number; totalActions: number }[]> {
    const results = await db
      .select({
        date: sql<string>`TO_CHAR(${featureUsage.createdAt}::date, 'YYYY-MM-DD')`,
        activeUsers: sql<number>`COUNT(DISTINCT ${featureUsage.userId})::int`,
        totalActions: sql<number>`COUNT(*)::int`,
      })
      .from(featureUsage)
      .where(
        and(
          sql`${featureUsage.createdAt} >= ${startDate}`,
          sql`${featureUsage.createdAt} <= ${endDate}`
        )
      )
      .groupBy(sql`${featureUsage.createdAt}::date`)
      .orderBy(sql`${featureUsage.createdAt}::date ASC`);

    return results;
  }

  async getMetricsOverview(): Promise<{ totalUsers: number; totalCompanies: number; totalActionsToday: number; totalActionsWeek: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const [[usersCount], [companiesCount], [todayCount], [weekCount]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(companies),
      db.select({ count: sql<number>`count(*)::int` }).from(featureUsage).where(sql`${featureUsage.createdAt} >= ${today}`),
      db.select({ count: sql<number>`count(*)::int` }).from(featureUsage).where(sql`${featureUsage.createdAt} >= ${weekAgo}`),
    ]);

    return {
      totalUsers: usersCount?.count || 0,
      totalCompanies: companiesCount?.count || 0,
      totalActionsToday: todayCount?.count || 0,
      totalActionsWeek: weekCount?.count || 0,
    };
  }

  // Tracking Locations Implementation
  async createTrackingLocation(data: { userId: number; routeId?: string; latitude: number; longitude: number; accuracy?: number; batteryLevel?: number; speed?: number; heading?: number; providerId?: number }): Promise<any> {
    const [location] = await db.insert(trackingLocations).values(data).returning();
    return location;
  }

  async getRouteTrackingLocations(routeId: string): Promise<any[]> {
    return await db.select()
      .from(trackingLocations)
      .where(eq(trackingLocations.routeId, routeId))
      .orderBy(trackingLocations.timestamp);
  }

  // Fuel Records Implementation
  async getFuelRecords(userId: number, filters?: { vehicleId?: number; startDate?: Date; endDate?: Date }): Promise<FuelRecord[]> {
    let conditions = [eq(fuelRecords.userId, userId)];

    if (filters?.vehicleId) {
      conditions.push(eq(fuelRecords.vehicleId, filters.vehicleId));
    }
    if (filters?.startDate) {
      conditions.push(gte(fuelRecords.fuelDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(fuelRecords.fuelDate, filters.endDate));
    }

    return await db.select()
      .from(fuelRecords)
      .where(and(...conditions))
      .orderBy(desc(fuelRecords.fuelDate));
  }

  async createFuelRecord(record: InsertFuelRecord, userId: number, companyId?: number | null): Promise<FuelRecord> {
    const [fuelRecord] = await db.insert(fuelRecords).values({
      ...record,
      userId,
      companyId: companyId ?? null,
    } as any).returning();
    return fuelRecord;
  }

  async getVehicleFuelStats(vehicleId: number, userId: number): Promise<{ totalLiters: number; totalCost: number; avgPricePerLiter: number; recordCount: number }> {
    const records = await db.select()
      .from(fuelRecords)
      .where(and(
        eq(fuelRecords.vehicleId, vehicleId),
        eq(fuelRecords.userId, userId)
      ));

    if (records.length === 0) {
      return { totalLiters: 0, totalCost: 0, avgPricePerLiter: 0, recordCount: 0 };
    }

    const totalLiters = records.reduce((sum, r) => sum + parseFloat(String(r.liters)), 0);
    const totalCost = records.reduce((sum, r) => sum + parseFloat(String(r.totalCost)), 0);
    const avgPricePerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

    return {
      totalLiters: Math.round(totalLiters * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      avgPricePerLiter: Math.round(avgPricePerLiter * 100) / 100,
      recordCount: records.length
    };
  }

  async getFleetFuelStats(userId: number, filters?: { vehicleIds?: number[]; fuelTypes?: string[] }): Promise<{
    totalSpent: number;
    totalLiters: number;
    avgPricePerLiter: number;
    costPerKm: number;
    avgKmPerLiter: number;
    totalRefuelings: number;
    spentVariation: number;
    litersVariation: number;
    byVehicle: { vehicleId: number; plate: string; model: string; totalSpent: number; totalLiters: number; kmPerLiter: number }[];
    monthlyEvolution: { month: string; totalSpent: number; totalLiters: number }[];
  }> {
    // Get all fuel records for user
    let allRecords = await db.select().from(fuelRecords).where(eq(fuelRecords.userId, userId));

    // Apply filters
    if (filters?.vehicleIds && filters.vehicleIds.length > 0) {
      allRecords = allRecords.filter(r => filters.vehicleIds!.includes(r.vehicleId));
    }
    if (filters?.fuelTypes && filters.fuelTypes.length > 0) {
      allRecords = allRecords.filter(r => filters.fuelTypes!.includes(r.fuelType));
    }

    // Get all vehicles for enriching data
    const allVehicles = await db.select().from(vehicles).where(eq(vehicles.userId, userId));
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

    // Current month calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthRecords = allRecords.filter(r => new Date(r.fuelDate) >= startOfMonth);
    const lastMonthRecords = allRecords.filter(r => {
      const date = new Date(r.fuelDate);
      return date >= startOfLastMonth && date <= endOfLastMonth;
    });

    // Calculate totals for this month
    const totalSpent = thisMonthRecords.reduce((sum, r) => sum + parseFloat(String(r.totalCost)), 0);
    const totalLiters = thisMonthRecords.reduce((sum, r) => sum + parseFloat(String(r.liters)), 0);
    const avgPricePerLiter = totalLiters > 0 ? totalSpent / totalLiters : 0;

    // Calculate last month totals for variation
    const lastMonthSpent = lastMonthRecords.reduce((sum, r) => sum + parseFloat(String(r.totalCost)), 0);
    const lastMonthLiters = lastMonthRecords.reduce((sum, r) => sum + parseFloat(String(r.liters)), 0);

    const spentVariation = lastMonthSpent > 0 ? Math.round(((totalSpent - lastMonthSpent) / lastMonthSpent) * 100) : 0;
    const litersVariation = lastMonthLiters > 0 ? Math.round(((totalLiters - lastMonthLiters) / lastMonthLiters) * 100) : 0;

    // Calculate km/L and cost per km from odometer data
    // Group records by vehicle and sort by date to calculate distances
    type FuelRecordType = typeof allRecords[number];
    const vehicleRecordsMap = new Map<number, FuelRecordType[]>();
    for (const record of allRecords) {
      if (!vehicleRecordsMap.has(record.vehicleId)) {
        vehicleRecordsMap.set(record.vehicleId, []);
      }
      vehicleRecordsMap.get(record.vehicleId)!.push(record);
    }

    let totalKmDriven = 0;
    let totalLitersWithOdometer = 0;
    const byVehicle: { vehicleId: number; plate: string; model: string; totalSpent: number; totalLiters: number; kmPerLiter: number }[] = [];

    const vehicleEntries = Array.from(vehicleRecordsMap.entries());
    for (const [vehicleId, records] of vehicleEntries) {
      const vehicle = vehicleMap.get(vehicleId);
      if (!vehicle) continue;

      // Sort by odometer to calculate distances
      const sortedByOdometer = records
        .filter((r: FuelRecordType) => r.odometerKm !== null)
        .sort((a: FuelRecordType, b: FuelRecordType) => (a.odometerKm || 0) - (b.odometerKm || 0));

      let vehicleKm = 0;
      let vehicleLiters = 0;
      let vehicleSpent = 0;

      // Apply filters for vehicle totals
      const filteredRecords = filters?.fuelTypes && filters.fuelTypes.length > 0
        ? records.filter((r: FuelRecordType) => filters.fuelTypes!.includes(r.fuelType))
        : records;

      for (const r of filteredRecords) {
        vehicleLiters += parseFloat(String(r.liters));
        vehicleSpent += parseFloat(String(r.totalCost));
      }

      // Calculate km driven (difference between last and first odometer)
      if (sortedByOdometer.length >= 2) {
        const filteredByOdometer = filters?.fuelTypes && filters.fuelTypes.length > 0
          ? sortedByOdometer.filter((r: FuelRecordType) => filters.fuelTypes!.includes(r.fuelType))
          : sortedByOdometer;

        if (filteredByOdometer.length >= 2) {
          vehicleKm = (filteredByOdometer[filteredByOdometer.length - 1].odometerKm || 0) - (filteredByOdometer[0].odometerKm || 0);
          totalKmDriven += vehicleKm;
          totalLitersWithOdometer += vehicleLiters;
        }
      }

      const kmPerLiter = vehicleLiters > 0 && vehicleKm > 0 ? vehicleKm / vehicleLiters : 0;

      byVehicle.push({
        vehicleId,
        plate: vehicle.plate,
        model: `${vehicle.brand} ${vehicle.model}`,
        totalSpent: Math.round(vehicleSpent * 100) / 100,
        totalLiters: Math.round(vehicleLiters * 100) / 100,
        kmPerLiter: Math.round(kmPerLiter * 100) / 100
      });
    }

    // Sort by efficiency (best first)
    byVehicle.sort((a, b) => b.kmPerLiter - a.kmPerLiter);

    const avgKmPerLiter = totalLitersWithOdometer > 0 && totalKmDriven > 0
      ? totalKmDriven / totalLitersWithOdometer
      : 0;
    const costPerKm = totalKmDriven > 0 ? totalSpent / totalKmDriven : 0;

    // Monthly evolution (last 6 months)
    const monthlyEvolution: { month: string; totalSpent: number; totalLiters: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      const monthRecords = allRecords.filter(r => {
        const date = new Date(r.fuelDate);
        return date >= monthStart && date <= monthEnd;
      });

      monthlyEvolution.push({
        month: monthKey,
        totalSpent: Math.round(monthRecords.reduce((sum, r) => sum + parseFloat(String(r.totalCost)), 0) * 100) / 100,
        totalLiters: Math.round(monthRecords.reduce((sum, r) => sum + parseFloat(String(r.liters)), 0) * 100) / 100
      });
    }

    return {
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalLiters: Math.round(totalLiters * 100) / 100,
      avgPricePerLiter: Math.round(avgPricePerLiter * 100) / 100,
      costPerKm: Math.round(costPerKm * 100) / 100,
      avgKmPerLiter: Math.round(avgKmPerLiter * 100) / 100,
      totalRefuelings: thisMonthRecords.length,
      spentVariation,
      litersVariation,
      byVehicle,
      monthlyEvolution
    };
  }
}

export const storage = new DatabaseStorage();