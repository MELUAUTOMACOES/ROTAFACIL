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
  users, clients, services, technicians, vehicles, appointments, checklists, businessRules, teams, teamMembers
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ilike } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  validateUser(email: string, password: string): Promise<User | null>;

  // Clients
  getClients(userId: number): Promise<Client[]>;
  getClient(id: number, userId: number): Promise<Client | undefined>;
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
  addTeamMember(teamMember: InsertTeamMember, userId: number): Promise<TeamMember>;
  removeTeamMember(id: number, userId: number): Promise<boolean>;

  // Route optimization
  optimizeRoute(appointmentIds: number[], userId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }>;
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

  // Clients
  async getClients(userId: number): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.userId, userId));
  }

  async getClient(id: number, userId: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.userId, userId)));
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
    const searchTerm = `%${query}%`;
    
    const results = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.userId, userId),
          or(
            ilike(clients.name, searchTerm),
            ilike(clients.email, searchTerm),
            ilike(clients.phone1, searchTerm),
            ilike(clients.phone2, searchTerm)
          )
        )
      )
      .limit(5);
    
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
    const [vehicle] = await db
      .insert(vehicles)
      .values({ ...insertVehicle, userId })
      .returning();
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>, userId: number): Promise<Vehicle> {
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
    const [appointment] = await db
      .update(appointments)
      .set(appointmentData)
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

  async addTeamMember(insertTeamMember: InsertTeamMember, userId: number): Promise<TeamMember> {
    const [teamMember] = await db.insert(teamMembers).values({ ...insertTeamMember, userId }).returning();
    return teamMember;
  }

  async removeTeamMember(id: number, userId: number): Promise<boolean> {
    const result = await db.delete(teamMembers).where(and(eq(teamMembers.id, id), eq(teamMembers.userId, userId)));
    return (result.rowCount || 0) > 0;
  }
}

export const storage = new DatabaseStorage();