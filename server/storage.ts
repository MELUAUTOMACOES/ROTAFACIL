import { 
  users, clients, services, technicians, vehicles, appointments, checklists,
  type User, type InsertUser, type Client, type InsertClient,
  type Service, type InsertService, type Technician, type InsertTechnician,
  type Vehicle, type InsertVehicle, type Appointment, type InsertAppointment,
  type Checklist, type InsertChecklist
} from "@shared/schema";
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

  // Route optimization
  optimizeRoute(appointmentIds: number[], userId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clients: Map<number, Client>;
  private services: Map<number, Service>;
  private technicians: Map<number, Technician>;
  private vehicles: Map<number, Vehicle>;
  private appointments: Map<number, Appointment>;
  private checklists: Map<number, Checklist>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.clients = new Map();
    this.services = new Map();
    this.technicians = new Map();
    this.vehicles = new Map();
    this.appointments = new Map();
    this.checklists = new Map();
    this.currentId = 1;
  }

  // Users
  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id, 
      password: hashedPassword,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  // Clients
  async getClients(userId: number): Promise<Client[]> {
    return Array.from(this.clients.values()).filter(client => client.userId === userId);
  }

  async getClient(id: number, userId: number): Promise<Client | undefined> {
    const client = this.clients.get(id);
    return client && client.userId === userId ? client : undefined;
  }

  async createClient(insertClient: InsertClient, userId: number): Promise<Client> {
    const id = this.currentId++;
    const client: Client = { ...insertClient, id, userId, createdAt: new Date() };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: number, clientData: Partial<InsertClient>, userId: number): Promise<Client> {
    const client = await this.getClient(id, userId);
    if (!client) throw new Error("Client not found");
    
    const updatedClient = { ...client, ...clientData };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: number, userId: number): Promise<boolean> {
    const client = await this.getClient(id, userId);
    if (!client) return false;
    
    return this.clients.delete(id);
  }

  // Services
  async getServices(userId: number): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => service.userId === userId);
  }

  async getService(id: number, userId: number): Promise<Service | undefined> {
    const service = this.services.get(id);
    return service && service.userId === userId ? service : undefined;
  }

  async createService(insertService: InsertService, userId: number): Promise<Service> {
    const id = this.currentId++;
    const service: Service = { ...insertService, id, userId, createdAt: new Date() };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: number, serviceData: Partial<InsertService>, userId: number): Promise<Service> {
    const service = await this.getService(id, userId);
    if (!service) throw new Error("Service not found");
    
    const updatedService = { ...service, ...serviceData };
    this.services.set(id, updatedService);
    return updatedService;
  }

  async deleteService(id: number, userId: number): Promise<boolean> {
    const service = await this.getService(id, userId);
    if (!service) return false;
    
    return this.services.delete(id);
  }

  // Technicians
  async getTechnicians(userId: number): Promise<Technician[]> {
    return Array.from(this.technicians.values()).filter(technician => technician.userId === userId);
  }

  async getTechnician(id: number, userId: number): Promise<Technician | undefined> {
    const technician = this.technicians.get(id);
    return technician && technician.userId === userId ? technician : undefined;
  }

  async createTechnician(insertTechnician: InsertTechnician, userId: number): Promise<Technician> {
    const id = this.currentId++;
    const technician: Technician = { ...insertTechnician, id, userId, createdAt: new Date() };
    this.technicians.set(id, technician);
    return technician;
  }

  async updateTechnician(id: number, technicianData: Partial<InsertTechnician>, userId: number): Promise<Technician> {
    const technician = await this.getTechnician(id, userId);
    if (!technician) throw new Error("Technician not found");
    
    const updatedTechnician = { ...technician, ...technicianData };
    this.technicians.set(id, updatedTechnician);
    return updatedTechnician;
  }

  async deleteTechnician(id: number, userId: number): Promise<boolean> {
    const technician = await this.getTechnician(id, userId);
    if (!technician) return false;
    
    return this.technicians.delete(id);
  }

  // Vehicles
  async getVehicles(userId: number): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values()).filter(vehicle => vehicle.userId === userId);
  }

  async getVehicle(id: number, userId: number): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    return vehicle && vehicle.userId === userId ? vehicle : undefined;
  }

  async createVehicle(insertVehicle: InsertVehicle, userId: number): Promise<Vehicle> {
    const id = this.currentId++;
    const vehicle: Vehicle = { ...insertVehicle, id, userId, createdAt: new Date() };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: number, vehicleData: Partial<InsertVehicle>, userId: number): Promise<Vehicle> {
    const vehicle = await this.getVehicle(id, userId);
    if (!vehicle) throw new Error("Vehicle not found");
    
    const updatedVehicle = { ...vehicle, ...vehicleData };
    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }

  async deleteVehicle(id: number, userId: number): Promise<boolean> {
    const vehicle = await this.getVehicle(id, userId);
    if (!vehicle) return false;
    
    return this.vehicles.delete(id);
  }

  // Appointments
  async getAppointments(userId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(appointment => appointment.userId === userId);
  }

  async getAppointment(id: number, userId: number): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    return appointment && appointment.userId === userId ? appointment : undefined;
  }

  async createAppointment(insertAppointment: InsertAppointment, userId: number): Promise<Appointment> {
    const id = this.currentId++;
    const appointment: Appointment = { ...insertAppointment, id, userId, createdAt: new Date() };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<InsertAppointment>, userId: number): Promise<Appointment> {
    const appointment = await this.getAppointment(id, userId);
    if (!appointment) throw new Error("Appointment not found");
    
    const updatedAppointment = { ...appointment, ...appointmentData };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: number, userId: number): Promise<boolean> {
    const appointment = await this.getAppointment(id, userId);
    if (!appointment) return false;
    
    return this.appointments.delete(id);
  }

  async getAppointmentsByDate(date: string, userId: number): Promise<Appointment[]> {
    const targetDate = new Date(date);
    return Array.from(this.appointments.values()).filter(appointment => {
      const appointmentDate = new Date(appointment.scheduledDate);
      return appointment.userId === userId &&
             appointmentDate.toDateString() === targetDate.toDateString();
    });
  }

  // Checklists
  async getChecklists(userId: number): Promise<Checklist[]> {
    return Array.from(this.checklists.values()).filter(checklist => checklist.userId === userId);
  }

  async getChecklist(id: number, userId: number): Promise<Checklist | undefined> {
    const checklist = this.checklists.get(id);
    return checklist && checklist.userId === userId ? checklist : undefined;
  }

  async createChecklist(insertChecklist: InsertChecklist, userId: number): Promise<Checklist> {
    const id = this.currentId++;
    const checklist: Checklist = { ...insertChecklist, id, userId, createdAt: new Date() };
    this.checklists.set(id, checklist);
    return checklist;
  }

  async updateChecklist(id: number, checklistData: Partial<InsertChecklist>, userId: number): Promise<Checklist> {
    const checklist = await this.getChecklist(id, userId);
    if (!checklist) throw new Error("Checklist not found");
    
    const updatedChecklist = { ...checklist, ...checklistData };
    this.checklists.set(id, updatedChecklist);
    return updatedChecklist;
  }

  async deleteChecklist(id: number, userId: number): Promise<boolean> {
    const checklist = await this.getChecklist(id, userId);
    if (!checklist) return false;
    
    return this.checklists.delete(id);
  }

  // Route optimization
  async optimizeRoute(appointmentIds: number[], userId: number): Promise<{ optimizedOrder: Appointment[], totalDistance: number, estimatedTime: number }> {
    const appointments = await Promise.all(
      appointmentIds.map(id => this.getAppointment(id, userId))
    );
    
    const validAppointments = appointments.filter(Boolean) as Appointment[];
    
    // Simple optimization simulation - in real implementation this would use Google Maps API
    const optimizedOrder = [...validAppointments].sort((a, b) => 
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );
    
    // Simulate distance and time calculations
    const totalDistance = validAppointments.length * 5 + Math.random() * 10; // km
    const estimatedTime = validAppointments.length * 45 + Math.random() * 30; // minutes
    
    return {
      optimizedOrder,
      totalDistance: Math.round(totalDistance * 100) / 100,
      estimatedTime: Math.round(estimatedTime)
    };
  }
}

export const storage = new MemStorage();
