import {
  type User, type InsertUser,
  type Client, type InsertClient,
  type Service, type InsertService,
  type Technician, type InsertTechnician,
  type Vehicle, type InsertVehicle,
  type VehicleAssignment, type InsertVehicleAssignment,
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
  type AnalyticsEvent, type InsertAnalyticsEvent,
  users, clients, services, technicians, vehicles, vehicleAssignments, appointments, appointmentHistory, checklists, businessRules, teams, teamMembers, accessSchedules,
  companies, memberships, invitations,
  dateRestrictions,
  routes, routeStops,
  type RouteStop,
  auditLogs,
  vehicleDocuments, vehicleMaintenances, maintenanceWarranties,
  featureUsage,
  trackingLocations,
  fuelRecords,
  analyticsEvents
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike, sql, inArray, isNotNull, ne, isNull, gte, lte, desc } from "drizzle-orm";
import { format } from "date-fns";
import bcrypt from "bcryptjs";
import { formatDateForSQLComparison } from "./timezone-helper";

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
  getUsersByCompanyId(companyId: number): Promise<User[]>;
  createUserByAdmin(userData: any, adminId: number): Promise<User>;
  updateUserByAdmin(userId: number, userData: any): Promise<User>;
  deleteUser(userId: number): Promise<boolean>;
  setEmailVerificationToken(userId: number, token: string, expiry: Date): Promise<void>;
  verifyEmail(token: string): Promise<User | null>;
  updatePassword(userId: number, newPassword: string): Promise<void>;
  setRequirePasswordChange(userId: number, require: boolean): Promise<void>;

  // Clients — companyId obrigatório para isolamento multi-tenant
  getAllClients(companyId: number): Promise<Client[]>;
  getClients(companyId: number, page?: number, limit?: number): Promise<{ data: Client[], total: number }>;
  getClient(id: number, companyId: number): Promise<Client | undefined>;
  getClientByCpf(cpf: string, companyId: number): Promise<Client | undefined>;
  createClient(client: InsertClient, userId: number, companyId: number): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>, companyId: number): Promise<Client>;
  deleteClient(id: number, companyId: number): Promise<boolean>;
  searchClients(query: string, companyId: number, page?: number, limit?: number): Promise<{ data: Client[], total: number }>;

  // Services
  getServices(companyId: number): Promise<Service[]>;
  getServicesPaged(companyId: number, page: number, pageSize: number, search?: string, isActive?: boolean): Promise<{ items: Service[], pagination: { page: number, pageSize: number, total: number, totalPages: number } }>;
  getService(id: number, companyId: number): Promise<Service | undefined>;
  createService(service: InsertService, userId: number, companyId: number): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>, companyId: number): Promise<Service>;
  deleteService(id: number, companyId: number): Promise<boolean>;

  // Technicians
  getTechnicians(companyId: number): Promise<Technician[]>;
  getTechniciansPaged(companyId: number, page: number, pageSize: number, search?: string, teamId?: number, isActive?: boolean): Promise<{ items: Technician[], pagination: { page: number, pageSize: number, total: number, totalPages: number } }>;
  getTechnician(id: number, companyId: number): Promise<Technician | undefined>;
  createTechnician(technician: InsertTechnician, userId: number, companyId: number): Promise<Technician>;
  updateTechnician(id: number, technician: Partial<InsertTechnician>, companyId: number): Promise<Technician>;
  deleteTechnician(id: number, companyId: number): Promise<boolean>;

  // Vehicles
  getVehicles(companyId: number): Promise<Vehicle[]>;
  getVehiclesPaged(companyId: number, page: number, pageSize: number, search?: string, responsibleType?: string, responsibleId?: number): Promise<{ items: Vehicle[], pagination: { page: number, pageSize: number, total: number, totalPages: number } }>;
  getVehicle(id: number, companyId: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle, userId: number, companyId: number): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<InsertVehicle>, companyId: number): Promise<Vehicle>;
  deleteVehicle(id: number, companyId: number): Promise<boolean>;

  // Vehicle Assignments (Permissions)
  getVehicleAssignments(vehicleId: number, companyId: number): Promise<VehicleAssignment[]>;
  createVehicleAssignment(assignment: InsertVehicleAssignment, userId: number, companyId: number): Promise<VehicleAssignment>;
  deleteVehicleAssignment(id: number, companyId: number): Promise<boolean>;
  syncVehicleAssignments(vehicleId: number, technicianIds: number[], teamIds: number[], userId: number, companyId: number): Promise<void>;
  getVehiclesAvailableForTechnician(technicianId: number, companyId: number): Promise<Vehicle[]>;
  getVehiclesAvailableForUser(userId: number, companyId: number): Promise<Vehicle[]>;

  // Appointments
  getAppointments(companyId: number): Promise<Appointment[]>;
  getAppointment(id: number, companyId: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment, userId: number, companyId: number): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>, companyId: number): Promise<Appointment>;
  deleteAppointment(id: number, companyId: number): Promise<boolean>;
  getAppointmentsByDate(date: string, companyId: number): Promise<Appointment[]>;

  // Checklists
  getChecklists(companyId: number): Promise<Checklist[]>;
  getChecklist(id: number, companyId: number): Promise<Checklist | undefined>;
  createChecklist(checklist: InsertChecklist, userId: number, companyId: number): Promise<Checklist>;
  updateChecklist(id: number, checklist: Partial<InsertChecklist>, companyId: number): Promise<Checklist>;
  deleteChecklist(id: number, companyId: number): Promise<boolean>;

  // Business Rules
  getBusinessRules(companyId: number): Promise<BusinessRules | undefined>;
  createBusinessRules(businessRules: InsertBusinessRules, userId: number, companyId: number): Promise<BusinessRules>;
  updateBusinessRules(id: number, businessRules: Partial<InsertBusinessRules>, companyId: number): Promise<BusinessRules>;

  // Teams
  getTeams(companyId: number): Promise<Team[]>;
  getTeamsPaged(companyId: number, page: number, pageSize: number, search?: string): Promise<{ items: Team[], pagination: { page: number, pageSize: number, total: number, totalPages: number } }>;
  getTeam(id: number, companyId: number): Promise<Team | undefined>;
  createTeam(team: InsertTeam, userId: number, companyId: number): Promise<Team>;
  updateTeam(id: number, team: Partial<InsertTeam>, companyId: number): Promise<Team>;
  deleteTeam(id: number, companyId: number): Promise<boolean>;
  getTeamMembers(teamId: number, companyId: number): Promise<TeamMember[]>;
  getAllTeamMembers(companyId: number): Promise<TeamMember[]>;
  createTeamMember(teamMember: InsertTeamMember, userId: number, companyId: number): Promise<TeamMember>;
  deleteTeamMember(id: number, companyId: number): Promise<boolean>;

  // Route optimization
  optimizeRoute(appointmentIds: number[], companyId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }>;

  // Access Schedules
  getAccessSchedules(companyId: number): Promise<AccessSchedule[]>;
  getAccessSchedule(id: number, companyId: number): Promise<AccessSchedule | undefined>;
  getAccessScheduleById(id: number): Promise<AccessSchedule | undefined>; // Busca apenas por ID (para validação)
  createAccessSchedule(schedule: InsertAccessSchedule, userId: number, companyId: number): Promise<AccessSchedule>;
  updateAccessSchedule(id: number, schedule: Partial<InsertAccessSchedule>, companyId: number): Promise<AccessSchedule>;
  deleteAccessSchedule(id: number, companyId: number): Promise<boolean>;

  // Date Restrictions (feriados / indisponibilidades por técnico/equipe)
  getDateRestrictions(companyId: number, start?: Date, end?: Date): Promise<DateRestriction[]>;
  createDateRestriction(data: InsertDateRestriction, userId: number, companyId: number): Promise<DateRestriction>;
  deleteDateRestriction(id: number, companyId: number): Promise<boolean>;

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

  // Provider Flow (userId = identidade do prestador / ator — legítimo)
  getProviderActiveRoute(userId: number, date: Date, companyId: number): Promise<Route | undefined>;
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
  updateRouteDate(id: string, date: Date, companyId: number): Promise<Route>;
  getRouteStops(routeId: string): Promise<RouteStop[]>;
  getPendingAppointments(companyId: number): Promise<any[]>;
  getAppointmentHistory(appointmentId: number): Promise<AppointmentHistory[]>;
  createAppointmentHistory(data: InsertAppointmentHistory, changedBy: number, ownerId: number, companyId: number): Promise<AppointmentHistory>;

  // Vehicle Documents
  getVehicleDocuments(vehicleId: number, companyId: number): Promise<VehicleDocument[]>;
  createVehicleDocument(document: InsertVehicleDocument, userId: number, companyId: number): Promise<VehicleDocument>;
  deleteVehicleDocument(id: number, companyId: number): Promise<boolean>;

  // Vehicle Maintenances
  getVehicleMaintenances(vehicleId: number, companyId: number): Promise<VehicleMaintenance[]>;
  getVehicleMaintenance(id: number, companyId: number): Promise<VehicleMaintenance | undefined>;
  createVehicleMaintenance(maintenance: InsertVehicleMaintenance, userId: number, companyId: number): Promise<VehicleMaintenance>;
  updateVehicleMaintenance(id: number, data: Partial<InsertVehicleMaintenance>, companyId: number): Promise<VehicleMaintenance>;
  deleteVehicleMaintenance(id: number, companyId: number): Promise<boolean>;

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

  // Tracking Locations (userId = identidade do prestador — legítimo)
  createTrackingLocation(data: { userId: number; companyId: number; routeId?: string; latitude: number; longitude: number; accuracy?: number; batteryLevel?: number; speed?: number; heading?: number; providerId?: number }): Promise<any>;
  getRouteTrackingLocations(routeId: string, companyId: number): Promise<any[]>;

  // Fuel Records
  getFuelRecords(companyId: number, filters?: { vehicleId?: number; startDate?: Date; endDate?: Date }): Promise<FuelRecord[]>;
  createFuelRecord(record: InsertFuelRecord, userId: number, companyId: number): Promise<FuelRecord>;
  getVehicleFuelStats(vehicleId: number, companyId: number): Promise<{ totalLiters: number; totalCost: number; avgPricePerLiter: number; recordCount: number }>;
  getFleetFuelStats(companyId: number, filters?: { vehicleIds?: number[]; fuelTypes?: string[]; startDate?: Date; endDate?: Date }): Promise<{
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

  // Analytics Events (Traffic Metrics - Landing Page)
  createAnalyticsEvent(data: InsertAnalyticsEvent): Promise<AnalyticsEvent>;

  // 🔐 LGPD - Aceite de termos
  acceptLgpd(userId: number, version: string): Promise<void>;
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

  async getUsersByCompanyId(companyId: number): Promise<User[]> {
    // 🏢 MULTI-TENANT: Buscar todos os usuários que têm membership ativa nesta empresa
    const result = await db
      .select({ user: users })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.companyId, companyId), eq(memberships.isActive, true)));
    return result.map(r => r.user);
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

  async updateRouteDate(id: string, date: Date, companyId: number): Promise<Route> {
    const [route] = await db
      .update(routes)
      .set({ date, updatedAt: new Date() })
      .where(and(eq(routes.id, id), this.byCompany(routes, companyId)))
      .returning();
    return route;
  }

  async getAppointmentHistory(appointmentId: number): Promise<AppointmentHistory[]> {
    return db.select()
      .from(appointmentHistory)
      .where(eq(appointmentHistory.appointmentId, appointmentId))
      .orderBy(desc(appointmentHistory.changedAt));
  }

  async createAppointmentHistory(data: InsertAppointmentHistory, changedBy: number, ownerId: number, companyId: number): Promise<AppointmentHistory> {
    const [history] = await db.insert(appointmentHistory).values({
      appointmentId: data.appointmentId,
      changedBy: changedBy,
      changedByName: data.changedByName,
      changeType: data.changeType,
      previousData: data.previousData,
      newData: data.newData,
      reason: data.reason,
      notes: data.notes,
      pendingResolutionId: data.pendingResolutionId,
      userId: ownerId,
      companyId,
    }).returning();
    return history;
  }

  // 🏢 Helper: retorna filtro por companyId (OBRIGATÓRIO - multi-tenant)
  // companyId DEVE ser validado antes de chamar (usar requireCompanyId nas rotas)
  private byCompany(table: any, companyId: number) {
    return eq(table.companyId, companyId);
  }

  // Clients
  async getAllClients(companyId: number): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(this.byCompany(clients, companyId))
      .orderBy(sql`${clients.createdAt} DESC`);
  }

  async getClients(companyId: number, page: number = 1, limit: number = 20): Promise<{ data: Client[], total: number }> {
    const offset = (page - 1) * limit;
    const filter = this.byCompany(clients, companyId);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(filter);

    const total = Number(countResult?.count || 0);

    const data = await db
      .select()
      .from(clients)
      .where(filter)
      .orderBy(sql`${clients.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getClient(id: number, companyId: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.id, id), this.byCompany(clients, companyId)));
    return client || undefined;
  }

  async getClientByCpf(cpf: string, companyId: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.cpf, cpf), this.byCompany(clients, companyId)));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient, userId: number, companyId: number): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values({ ...insertClient, userId, companyId })
      .returning();
    return client;
  }

  async updateClient(id: number, clientData: Partial<InsertClient>, companyId: number): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(clientData)
      .where(and(eq(clients.id, id), this.byCompany(clients, companyId)))
      .returning();
    return client;
  }

  async deleteClient(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(clients)
      .where(and(eq(clients.id, id), this.byCompany(clients, companyId)));
    return (result.rowCount || 0) > 0;
  }

  async searchClients(query: string, companyId: number, page: number = 1, limit: number = 20): Promise<{ data: Client[], total: number }> {
    console.log("Busca cliente - input:", query);
    const searchTerm = `%${query}%`;
    const filter = this.byCompany(clients, companyId);

    // Tenta limpar a query para ver se é apenas números (busca por CPF)
    const numericQuery = query.replace(/\D/g, '');
    const isCpfSearch = numericQuery.length > 0;

    let whereClause;

    if (isCpfSearch) {
      whereClause = and(
        filter,
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.cpf, searchTerm),
          sql`regexp_replace(${clients.cpf}, '\\D', '', 'g') LIKE ${`%${numericQuery}%`}`
        )
      );
    } else {
      whereClause = and(
        filter,
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
  async getServices(companyId: number): Promise<Service[]> {
    return await db.select().from(services).where(this.byCompany(services, companyId));
  }

  async getServicesPaged(companyId: number, page: number, pageSize: number, search?: string, isActive?: boolean) {
    const conditions = [this.byCompany(services, companyId)];

    if (search) {
      conditions.push(
        or(
          ilike(services.name, `%${search}%`),
          ilike(services.description, `%${search}%`)
        )!
      );
    }
    if (isActive !== undefined) {
      conditions.push(eq(services.isActive, isActive));
    }

    const whereClause = and(...conditions);

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(services)
      .where(whereClause);

    // Fetch paginated items
    const items = await db
      .select()
      .from(services)
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  async getService(id: number, companyId: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(and(eq(services.id, id), this.byCompany(services, companyId)));
    return service || undefined;
  }

  async createService(insertService: InsertService, userId: number, companyId: number): Promise<Service> {
    const [service] = await db
      .insert(services)
      .values({ ...insertService, userId, companyId })
      .returning();
    return service;
  }

  async updateService(id: number, serviceData: Partial<InsertService>, companyId: number): Promise<Service> {
    const [service] = await db
      .update(services)
      .set(serviceData)
      .where(and(eq(services.id, id), this.byCompany(services, companyId)))
      .returning();
    return service;
  }

  async deleteService(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(services)
      .where(and(eq(services.id, id), this.byCompany(services, companyId)));
    return (result.rowCount || 0) > 0;
  }

  // Technicians
  async getTechnicians(companyId: number): Promise<Technician[]> {
    return await db.select().from(technicians).where(this.byCompany(technicians, companyId));
  }

  async getTechniciansPaged(companyId: number, page: number, pageSize: number, search?: string, teamId?: number, isActive?: boolean) {
    const conditions = [this.byCompany(technicians, companyId)];

    if (search) {
      conditions.push(
        or(
          ilike(technicians.name, `%${search}%`),
          ilike(technicians.email, `%${search}%`)
        )!
      );
    }
    if (teamId !== undefined) {
      conditions.push(eq(technicians.teamId, teamId));
    }
    if (isActive !== undefined) {
      conditions.push(eq(technicians.isActive, isActive));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(technicians)
      .where(whereClause);

    const items = await db
      .select()
      .from(technicians)
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  async getTechnician(id: number, companyId: number): Promise<Technician | undefined> {
    const [technician] = await db.select().from(technicians).where(and(eq(technicians.id, id), this.byCompany(technicians, companyId)));
    return technician || undefined;
  }

  async createTechnician(insertTechnician: InsertTechnician, userId: number, companyId: number): Promise<Technician> {
    const [technician] = await db
      .insert(technicians)
      .values({ ...insertTechnician, userId, companyId })
      .returning();
    return technician;
  }

  async updateTechnician(id: number, technicianData: Partial<InsertTechnician>, companyId: number): Promise<Technician> {
    const [technician] = await db
      .update(technicians)
      .set(technicianData)
      .where(and(eq(technicians.id, id), this.byCompany(technicians, companyId)))
      .returning();
    return technician;
  }

  async deleteTechnician(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(technicians)
      .where(and(eq(technicians.id, id), this.byCompany(technicians, companyId)));
    return (result.rowCount || 0) > 0;
  }

  // Vehicles
  async getVehicles(companyId: number): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(this.byCompany(vehicles, companyId));
  }

  async getVehiclesPaged(companyId: number, page: number, pageSize: number, search?: string, responsibleType?: string, responsibleId?: number) {
    const conditions = [this.byCompany(vehicles, companyId)];

    if (search) {
      conditions.push(
        or(
          ilike(vehicles.plate, `%${search}%`),
          ilike(vehicles.brand, `%${search}%`),
          ilike(vehicles.model, `%${search}%`)
        )!
      );
    }
    if (responsibleType === 'technician' && responsibleId !== undefined) {
      conditions.push(eq(vehicles.technicianId, responsibleId));
    }
    if (responsibleType === 'team' && responsibleId !== undefined) {
      conditions.push(eq(vehicles.teamId, responsibleId));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vehicles)
      .where(whereClause);

    const items = await db
      .select()
      .from(vehicles)
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  async getVehicle(id: number, companyId: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(and(eq(vehicles.id, id), this.byCompany(vehicles, companyId)));
    return vehicle || undefined;
  }

  async createVehicle(insertVehicle: InsertVehicle, userId: number, companyId: number): Promise<Vehicle> {
    // 🔒 Validar unicidade: apenas 1 veículo por técnico/equipe
    if (insertVehicle.technicianId) {
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.technicianId, insertVehicle.technicianId),
            this.byCompany(vehicles, companyId)
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
            this.byCompany(vehicles, companyId)
          )
        )
        .limit(1);

      if (existing) {
        throw new Error(`Esta equipe já está vinculada ao veículo: ${existing.plate}`);
      }
    }

    const [vehicle] = await db
      .insert(vehicles)
      .values({ ...insertVehicle, userId, companyId } as any)
      .returning();
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>, companyId: number): Promise<Vehicle> {
    // 🔒 Validar unicidade: apenas 1 veículo por técnico/equipe
    if (vehicleData.technicianId) {
      const [existing] = await db
        .select()
        .from(vehicles)
        .where(
          and(
            eq(vehicles.technicianId, vehicleData.technicianId),
            this.byCompany(vehicles, companyId)
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
            this.byCompany(vehicles, companyId)
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
      .where(and(eq(vehicles.id, id), this.byCompany(vehicles, companyId)))
      .returning();
    return vehicle;
  }

  async deleteVehicle(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), this.byCompany(vehicles, companyId)));
    return (result.rowCount || 0) > 0;
  }

  // Vehicle Assignments (Permissions)
  async getVehicleAssignments(vehicleId: number, companyId: number): Promise<VehicleAssignment[]> {
    return await db
      .select()
      .from(vehicleAssignments)
      .where(
        and(
          eq(vehicleAssignments.vehicleId, vehicleId),
          eq(vehicleAssignments.companyId, companyId),
          eq(vehicleAssignments.isActive, true)
        )
      );
  }

  async createVehicleAssignment(assignment: InsertVehicleAssignment, userId: number, companyId: number): Promise<VehicleAssignment> {
    const [created] = await db
      .insert(vehicleAssignments)
      .values({ ...assignment, userId, companyId } as any)
      .returning();
    return created;
  }

  async deleteVehicleAssignment(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .update(vehicleAssignments)
      .set({ isActive: false })
      .where(and(eq(vehicleAssignments.id, id), eq(vehicleAssignments.companyId, companyId)));
    return (result.rowCount || 0) > 0;
  }

  async syncVehicleAssignments(
    vehicleId: number,
    technicianIds: number[],
    teamIds: number[],
    userId: number,
    companyId: number
  ): Promise<void> {
    // Desativar todas as autorizações existentes para este veículo
    await db
      .update(vehicleAssignments)
      .set({ isActive: false })
      .where(
        and(
          eq(vehicleAssignments.vehicleId, vehicleId),
          eq(vehicleAssignments.companyId, companyId)
        )
      );

    // Inserir novas autorizações para técnicos
    if (technicianIds.length > 0) {
      const technicianAssignments = technicianIds.map(technicianId => ({
        vehicleId,
        technicianId,
        teamId: null,
        userId,
        companyId,
        isActive: true
      }));
      
      await db.insert(vehicleAssignments).values(technicianAssignments as any);
    }

    // Inserir novas autorizações para equipes
    if (teamIds.length > 0) {
      const teamAssignments = teamIds.map(teamId => ({
        vehicleId,
        technicianId: null,
        teamId,
        userId,
        companyId,
        isActive: true
      }));
      
      await db.insert(vehicleAssignments).values(teamAssignments as any);
    }
  }

  async getVehiclesAvailableForTechnician(technicianId: number, companyId: number): Promise<Vehicle[]> {
    // Buscar veículos autorizados diretamente para o técnico
    const directVehicles = await db
      .select({ vehicle: vehicles })
      .from(vehicleAssignments)
      .innerJoin(vehicles, eq(vehicleAssignments.vehicleId, vehicles.id))
      .where(
        and(
          eq(vehicleAssignments.technicianId, technicianId),
          eq(vehicleAssignments.companyId, companyId),
          eq(vehicleAssignments.isActive, true),
          eq(vehicles.companyId, companyId)
        )
      );

    // Buscar equipes do técnico
    const technicianTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.technicianId, technicianId),
          eq(teamMembers.companyId, companyId)
        )
      );

    const teamIds = technicianTeams.map(t => t.teamId);

    // Buscar veículos autorizados para as equipes do técnico
    let teamVehicles: { vehicle: Vehicle }[] = [];
    if (teamIds.length > 0) {
      teamVehicles = await db
        .select({ vehicle: vehicles })
        .from(vehicleAssignments)
        .innerJoin(vehicles, eq(vehicleAssignments.vehicleId, vehicles.id))
        .where(
          and(
            inArray(vehicleAssignments.teamId, teamIds),
            eq(vehicleAssignments.companyId, companyId),
            eq(vehicleAssignments.isActive, true),
            eq(vehicles.companyId, companyId)
          )
        );
    }

    // Combinar e remover duplicados
    const allVehicles = [...directVehicles, ...teamVehicles];
    const uniqueVehicles = Array.from(
      new Map(allVehicles.map(v => [v.vehicle.id, v.vehicle])).values()
    );

    return uniqueVehicles;
  }

  async getVehiclesAvailableForUser(userId: number, companyId: number): Promise<Vehicle[]> {
    // Buscar técnico vinculado ao usuário
    const [technician] = await db
      .select()
      .from(technicians)
      .where(
        and(
          eq(technicians.userId, userId),
          eq(technicians.companyId, companyId)
        )
      )
      .limit(1);

    if (!technician) {
      return [];
    }

    return await this.getVehiclesAvailableForTechnician(technician.id, companyId);
  }

  // Appointments
  async getAppointments(companyId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(this.byCompany(appointments, companyId));
  }

  async getAppointment(id: number, companyId: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(and(eq(appointments.id, id), this.byCompany(appointments, companyId)));
    return appointment || undefined;
  }

  async createAppointment(insertAppointment: InsertAppointment, userId: number, companyId: number): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values({ ...insertAppointment, userId, companyId })
      .returning();
    return appointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<InsertAppointment>, companyId: number): Promise<Appointment> {
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
      .where(and(eq(appointments.id, id), this.byCompany(appointments, companyId)))
      .returning();

    return appointment;
  }

  async deleteAppointment(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(and(eq(appointments.id, id), this.byCompany(appointments, companyId)));
    return (result.rowCount || 0) > 0;
  }

  async getAppointmentsByDate(date: string, companyId: number): Promise<Appointment[]> {
    // Converter string de data para range do dia inteiro
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.select()
      .from(appointments)
      .where(and(
        this.byCompany(appointments, companyId),
        gte(appointments.scheduledDate, startOfDay),
        lte(appointments.scheduledDate, endOfDay)
      ));
  }

  // Checklists
  async getChecklists(companyId: number): Promise<Checklist[]> {
    return await db.select().from(checklists).where(this.byCompany(checklists, companyId));
  }

  async getChecklist(id: number, companyId: number): Promise<Checklist | undefined> {
    const [checklist] = await db.select().from(checklists).where(and(eq(checklists.id, id), this.byCompany(checklists, companyId)));
    return checklist || undefined;
  }

  async createChecklist(insertChecklist: InsertChecklist, userId: number, companyId: number): Promise<Checklist> {
    const [checklist] = await db
      .insert(checklists)
      .values({ ...insertChecklist, userId, companyId } as any)
      .returning();
    return checklist;
  }

  async updateChecklist(id: number, checklistData: Partial<InsertChecklist>, companyId: number): Promise<Checklist> {
    const [checklist] = await db
      .update(checklists)
      .set(checklistData)
      .where(and(eq(checklists.id, id), this.byCompany(checklists, companyId)))
      .returning();
    return checklist;
  }

  async deleteChecklist(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(checklists)
      .where(and(eq(checklists.id, id), this.byCompany(checklists, companyId)));
    return (result.rowCount || 0) > 0;
  }

  // Business Rules
  async getBusinessRules(companyId: number): Promise<BusinessRules | undefined> {
    const [rules] = await db.select().from(businessRules).where(this.byCompany(businessRules, companyId));
    return rules || undefined;
  }

  async createBusinessRules(insertBusinessRules: InsertBusinessRules, userId: number, companyId: number): Promise<BusinessRules> {
    const [rules] = await db
      .insert(businessRules)
      .values({ ...insertBusinessRules, userId, companyId } as any)
      .returning();
    return rules;
  }

  async updateBusinessRules(id: number, rulesData: Partial<InsertBusinessRules>, companyId: number): Promise<BusinessRules> {
    const [rules] = await db
      .update(businessRules)
      .set(rulesData as any)
      .where(and(eq(businessRules.id, id), this.byCompany(businessRules, companyId)))
      .returning();
    return rules;
  }

  // Route optimization
  async optimizeRoute(appointmentIds: number[], companyId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }> {
    const allAppointments = await db.select().from(appointments).where(this.byCompany(appointments, companyId));
    const appointmentsList = allAppointments.filter(apt => appointmentIds.includes(apt.id));

    // Simple optimization - in production you'd implement actual routing algorithms
    return {
      optimizedOrder: appointmentsList,
      totalDistance: appointmentsList.length * 5, // Mock calculation
      estimatedTime: appointmentsList.length * 30 // Mock calculation
    };
  }

  // Teams - Implementação das operações de equipes conforme solicitado
  async getTeams(companyId: number): Promise<Team[]> {
    return await db.select().from(teams).where(this.byCompany(teams, companyId));
  }

  async getTeamsPaged(companyId: number, page: number, pageSize: number, search?: string) {
    const conditions = [this.byCompany(teams, companyId)];

    if (search) {
      conditions.push(ilike(teams.name, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(whereClause);

    const items = await db
      .select()
      .from(teams)
      .where(whereClause)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  }

  async getTeam(id: number, companyId: number): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(and(eq(teams.id, id), this.byCompany(teams, companyId)));
    return team || undefined;
  }

  async createTeam(insertTeam: InsertTeam, userId: number, companyId: number): Promise<Team> {
    const [team] = await db.insert(teams).values({ ...insertTeam, userId, companyId }).returning();
    return team;
  }

  async updateTeam(id: number, teamData: Partial<InsertTeam>, companyId: number): Promise<Team> {
    const [team] = await db.update(teams)
      .set(teamData)
      .where(and(eq(teams.id, id), this.byCompany(teams, companyId)))
      .returning();
    return team;
  }

  async deleteTeam(id: number, companyId: number): Promise<boolean> {
    // Remove membros da equipe primeiro
    await db.delete(teamMembers).where(and(eq(teamMembers.teamId, id), this.byCompany(teamMembers, companyId)));

    const result = await db.delete(teams).where(and(eq(teams.id, id), this.byCompany(teams, companyId)));
    return (result.rowCount || 0) > 0;
  }

  async getTeamMembers(teamId: number, companyId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(and(eq(teamMembers.teamId, teamId), this.byCompany(teamMembers, companyId)));
  }

  async getAllTeamMembers(companyId: number): Promise<TeamMember[]> {
    return await db.select().from(teamMembers).where(this.byCompany(teamMembers, companyId));
  }

  async createTeamMember(insertTeamMember: InsertTeamMember, userId: number, companyId: number): Promise<TeamMember> {
    const [teamMember] = await db.insert(teamMembers).values({ ...insertTeamMember, userId, companyId }).returning();
    return teamMember;
  }

  async deleteTeamMember(id: number, companyId: number): Promise<boolean> {
    const result = await db.delete(teamMembers).where(and(eq(teamMembers.id, id), this.byCompany(teamMembers, companyId)));
    return (result.rowCount || 0) > 0;
  }

  // Provider Flow Implementation
  async getProviderActiveRoute(userId: number, date: Date, companyId: number): Promise<Route | undefined> {
    // 1. Buscar rotas onde o usuário é o responsável direto (technician)
    // OU onde o usuário faz parte da equipe responsável (team)
    // 🔒 FILTRO MULTI-TENANT OBRIGATÓRIO

    // 🌎 Usar horário de São Paulo (UTC-3) para comparação de data
    const dateStrSP = formatDateForSQLComparison(date);

    // Buscar técnico associado ao usuário (filtrado por companyId)
    const [tech] = await db.select().from(technicians).where(and(eq(technicians.userId, userId), eq(technicians.companyId, companyId)));

    // Buscar equipes que o usuário faz parte (filtrado por companyId via teamMembers)
    const userTeams = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.companyId, companyId)));

    const teamIds = userTeams.map(t => t.teamId);

    // Construir query
    const conditions = [
      and(
        // 🔒 Filtro multi-tenant obrigatório
        eq(routes.companyId, companyId),
        // 🌎 Comparar data considerando timezone de São Paulo (UTC-3)
        sql`DATE(${routes.date} AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') = ${dateStrSP}`,

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

      // 🔒 companyId obrigatório para histórico (deve estar presente após migration 0028)
      if (currentAppointment.companyId) {
        await this.createAppointmentHistory(historyData, userId, currentAppointment.userId, currentAppointment.companyId);
      }
    }

    const [updated] = await db
      .update(appointments)
      .set(updateData)
      .where(eq(appointments.id, id))
      .returning();

    return updated;
  }

  async getPendingAppointments(companyId: number): Promise<any[]> {
    // Buscar agendamentos de rotas finalizadas que não foram concluídos
    const ownerCond = this.byCompany(routes, companyId);

    // 1. Buscar rotas finalizadas
    const finalizedRoutes = await db
      .select({ id: routes.id, status: routes.status, title: routes.title, date: routes.date })
      .from(routes)
      .where(and(
        ownerCond,
        or(eq(routes.status, 'finalizado'), eq(routes.status, 'cancelado'), eq(routes.status, 'incompleto'))
      ))
      .orderBy(sql`${routes.date} DESC`);

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
      clientIds.length > 0 ? db.select().from(clients).where(and(inArray(clients.id, clientIds), this.byCompany(clients, companyId))) : Promise.resolve([]),
      serviceIds.length > 0 ? db.select().from(services).where(and(inArray(services.id, serviceIds), this.byCompany(services, companyId))) : Promise.resolve([]),
      technicianIds.length > 0 ? db.select().from(technicians).where(and(inArray(technicians.id, technicianIds), this.byCompany(technicians, companyId))) : Promise.resolve([]),
      teamIds.length > 0 ? db.select().from(teams).where(and(inArray(teams.id, teamIds), this.byCompany(teams, companyId))) : Promise.resolve([]),
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

      // Determinar tipo de pendência
      const isPendingExecution = !apt.executionStatus || apt.executionStatus !== 'concluido';
      const isPendingPayment = apt.paymentStatus === 'nao_pago';

      // Se tem ambas pendências, priorizar execução
      const pendingType = isPendingExecution ? 'execution' : (isPendingPayment ? 'payment' : 'execution');

      return {
        ...apt,
        routeDate: route?.date,
        routeTitle: route?.title,
        clientName: client?.name,
        serviceName: service?.name,
        servicePrice: service?.price ? Number(service.price) : null, // 💰 Adicionar preço do serviço
        responsibleName: technician?.name || team?.name || 'N/A',
        pendingType, // 🏷️ Tipo de pendência: 'execution' ou 'payment'
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
  async getAccessSchedules(companyId: number): Promise<AccessSchedule[]> {
    return await db.select().from(accessSchedules).where(this.byCompany(accessSchedules, companyId));
  }

  async getAccessSchedule(id: number, companyId: number): Promise<AccessSchedule | undefined> {
    const [schedule] = await db.select().from(accessSchedules).where(and(eq(accessSchedules.id, id), this.byCompany(accessSchedules, companyId)));
    return schedule || undefined;
  }

  // Busca tabela de horário apenas por ID (sem filtrar por userId)
  // Usado para validação de acesso de usuários que referenciam a tabela
  async getAccessScheduleById(id: number): Promise<AccessSchedule | undefined> {
    const [schedule] = await db.select().from(accessSchedules).where(eq(accessSchedules.id, id));
    return schedule || undefined;
  }

  async createAccessSchedule(insertSchedule: InsertAccessSchedule, userId: number, companyId: number): Promise<AccessSchedule> {
    const [schedule] = await db.insert(accessSchedules).values({ ...insertSchedule, userId, companyId }).returning();
    return schedule;
  }

  async updateAccessSchedule(id: number, scheduleData: Partial<InsertAccessSchedule>, companyId: number): Promise<AccessSchedule> {
    const [schedule] = await db.update(accessSchedules)
      .set(scheduleData)
      .where(and(eq(accessSchedules.id, id), this.byCompany(accessSchedules, companyId)))
      .returning();
    return schedule;
  }

  async deleteAccessSchedule(id: number, companyId: number): Promise<boolean> {
    // Antes de deletar, remover referências em usuários
    await db.update(users)
      .set({ accessScheduleId: null })
      .where(eq(users.accessScheduleId, id));

    // Remover por ID + companyId
    const result = await db.delete(accessSchedules).where(and(eq(accessSchedules.id, id), this.byCompany(accessSchedules, companyId)));
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
  async getDateRestrictions(companyId: number, start?: Date, end?: Date): Promise<DateRestriction[]> {
    const baseWhere = this.byCompany(dateRestrictions, companyId);

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

  async createDateRestriction(insertRestriction: InsertDateRestriction, userId: number, companyId: number): Promise<DateRestriction> {
    const [restriction] = await db
      .insert(dateRestrictions)
      .values({ ...insertRestriction, userId, companyId })
      .returning();
    return restriction;
  }

  async deleteDateRestriction(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(dateRestrictions)
      .where(and(eq(dateRestrictions.id, id), this.byCompany(dateRestrictions, companyId)));
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
  async getVehicleDocuments(vehicleId: number, companyId: number): Promise<VehicleDocument[]> {
    return await db
      .select()
      .from(vehicleDocuments)
      .where(and(eq(vehicleDocuments.vehicleId, vehicleId), this.byCompany(vehicleDocuments, companyId)))
      .orderBy(sql`${vehicleDocuments.createdAt} DESC`);
  }

  async createVehicleDocument(document: InsertVehicleDocument, userId: number, companyId: number): Promise<VehicleDocument> {
    const [doc] = await db
      .insert(vehicleDocuments)
      .values({ ...document, userId, companyId })
      .returning();
    return doc;
  }

  async deleteVehicleDocument(id: number, companyId: number): Promise<boolean> {
    const result = await db
      .delete(vehicleDocuments)
      .where(and(eq(vehicleDocuments.id, id), this.byCompany(vehicleDocuments, companyId)));
    return (result.rowCount || 0) > 0;
  }

  // Vehicle Maintenances
  async getVehicleMaintenances(vehicleId: number, companyId: number): Promise<VehicleMaintenance[]> {
    return await db
      .select()
      .from(vehicleMaintenances)
      .where(and(eq(vehicleMaintenances.vehicleId, vehicleId), this.byCompany(vehicleMaintenances, companyId)))
      .orderBy(sql`${vehicleMaintenances.entryDate} DESC`);
  }

  async getVehicleMaintenance(id: number, companyId: number): Promise<VehicleMaintenance | undefined> {
    const [maintenance] = await db
      .select()
      .from(vehicleMaintenances)
      .where(and(eq(vehicleMaintenances.id, id), this.byCompany(vehicleMaintenances, companyId)));
    return maintenance || undefined;
  }

  async createVehicleMaintenance(maintenance: InsertVehicleMaintenance, userId: number, companyId: number): Promise<VehicleMaintenance> {
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
        companyId,
        updatedAt: new Date()
      })
      .returning();
    return created;
  }

  async updateVehicleMaintenance(id: number, data: Partial<InsertVehicleMaintenance>, companyId: number): Promise<VehicleMaintenance> {
    // Recalcular totalCost se laborCost ou materialsCost foram alterados
    let updateData: any = { ...data, updatedAt: new Date() };

    if (data.laborCost !== undefined || data.materialsCost !== undefined) {
      // Buscar registro atual para pegar valores não alterados
      const current = await this.getVehicleMaintenance(id, companyId);
      if (current) {
        const laborCost = parseFloat(String(data.laborCost ?? current.laborCost ?? 0));
        const materialsCost = parseFloat(String(data.materialsCost ?? current.materialsCost ?? 0));
        updateData.totalCost = (laborCost + materialsCost).toFixed(2);
      }
    }

    const [updated] = await db
      .update(vehicleMaintenances)
      .set(updateData)
      .where(and(eq(vehicleMaintenances.id, id), this.byCompany(vehicleMaintenances, companyId)))
      .returning();
    return updated;
  }

  async deleteVehicleMaintenance(id: number, companyId: number): Promise<boolean> {
    // Cascade delete de warranties é automático pela FK
    const result = await db
      .delete(vehicleMaintenances)
      .where(and(eq(vehicleMaintenances.id, id), this.byCompany(vehicleMaintenances, companyId)));
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
  async createTrackingLocation(data: { userId: number; companyId: number; routeId?: string; latitude: number; longitude: number; accuracy?: number; batteryLevel?: number; speed?: number; heading?: number; providerId?: number }): Promise<any> {
    const [location] = await db.insert(trackingLocations).values(data).returning();
    return location;
  }

  async getRouteTrackingLocations(routeId: string, companyId: number): Promise<any[]> {
    return await db.select()
      .from(trackingLocations)
      .where(and(eq(trackingLocations.routeId, routeId), eq(trackingLocations.companyId, companyId)))
      .orderBy(trackingLocations.timestamp);
  }

  // Fuel Records Implementation
  async getFuelRecords(companyId: number, filters?: { vehicleId?: number; startDate?: Date; endDate?: Date }): Promise<FuelRecord[]> {
    let conditions = [this.byCompany(fuelRecords, companyId)];

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

  async createFuelRecord(record: InsertFuelRecord, userId: number, companyId: number): Promise<FuelRecord> {
    const [fuelRecord] = await db.insert(fuelRecords).values({
      ...record,
      userId,
      companyId,
    } as any).returning();
    return fuelRecord;
  }

  async getVehicleFuelStats(vehicleId: number, companyId: number): Promise<{ totalLiters: number; totalCost: number; avgPricePerLiter: number; recordCount: number }> {
    const records = await db.select()
      .from(fuelRecords)
      .where(and(
        eq(fuelRecords.vehicleId, vehicleId),
        this.byCompany(fuelRecords, companyId)
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

  async getFleetFuelStats(companyId: number, filters?: { vehicleIds?: number[]; fuelTypes?: string[]; startDate?: Date; endDate?: Date }): Promise<{
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
    // Get all fuel records for company
    let allRecords = await db.select().from(fuelRecords).where(this.byCompany(fuelRecords, companyId));

    // Apply filters
    if (filters?.vehicleIds && filters.vehicleIds.length > 0) {
      allRecords = allRecords.filter(r => filters.vehicleIds!.includes(r.vehicleId));
    }
    if (filters?.fuelTypes && filters.fuelTypes.length > 0) {
      allRecords = allRecords.filter(r => filters.fuelTypes!.includes(r.fuelType));
    }

    // Get all vehicles for enriching data
    const allVehicles = await db.select().from(vehicles).where(this.byCompany(vehicles, companyId));
    const vehicleMap = new Map(allVehicles.map(v => [v.id, v]));

    // Calculate period based on filters or use current month
    const now = new Date();
    const startOfMonth = filters?.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = filters?.endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Calculate previous period for variation (same duration before the selected period)
    const periodDuration = endOfMonth.getTime() - startOfMonth.getTime();
    const previousPeriodStart = new Date(startOfMonth.getTime() - periodDuration);
    const previousPeriodEnd = new Date(startOfMonth.getTime() - 1);

    const periodRecords = allRecords.filter(r => {
      const date = new Date(r.fuelDate);
      return date >= startOfMonth && date <= endOfMonth;
    });
    const previousPeriodRecords = allRecords.filter(r => {
      const date = new Date(r.fuelDate);
      return date >= previousPeriodStart && date <= previousPeriodEnd;
    });

    // Calculate totals for selected period
    const totalSpent = periodRecords.reduce((sum, r) => sum + parseFloat(String(r.totalCost)), 0);
    const totalLiters = periodRecords.reduce((sum, r) => sum + parseFloat(String(r.liters)), 0);
    const avgPricePerLiter = totalLiters > 0 ? totalSpent / totalLiters : 0;

    // Calculate previous period totals for variation
    const previousPeriodSpent = previousPeriodRecords.reduce((sum, r) => sum + parseFloat(String(r.totalCost)), 0);
    const previousPeriodLiters = previousPeriodRecords.reduce((sum, r) => sum + parseFloat(String(r.liters)), 0);

    const spentVariation = previousPeriodSpent > 0 ? Math.round(((totalSpent - previousPeriodSpent) / previousPeriodSpent) * 100) : 0;
    const litersVariation = previousPeriodLiters > 0 ? Math.round(((totalLiters - previousPeriodLiters) / previousPeriodLiters) * 100) : 0;

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
      totalRefuelings: periodRecords.length,
      spentVariation,
      litersVariation,
      byVehicle,
      monthlyEvolution
    };
  }
  // ==================== ANALYTICS EVENTS ====================
  /**
   * Registra um evento de analytics (landing page tracking)
   * @param data - Dados do evento (nome, UTMs, device, etc.)
   */
  async createAnalyticsEvent(data: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [event] = await db
      .insert(analyticsEvents)
      .values(data)
      .returning();
    return event;
  }

  // ==================== LGPD ====================
  /**
   * Registra o aceite dos termos LGPD pelo usuário
   * @param userId - ID do usuário
   * @param version - Versão do termo aceito (ex: "v1.0-2025-01")
   */
  async acceptLgpd(userId: number, version: string): Promise<void> {
    await db.update(users)
      .set({
        lgpdAccepted: true,
        lgpdAcceptedAt: new Date(),
        lgpdVersion: version,
      })
      .where(eq(users.id, userId));
    console.log(`✅ [LGPD] Aceite registrado: userId=${userId}, version=${version}`);
  }
}

export const storage = new DatabaseStorage();