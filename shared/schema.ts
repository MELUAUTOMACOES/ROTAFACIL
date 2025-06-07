import { pgTable, text, serial, integer, boolean, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("basic"), // basic, professional
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone1: text("phone1"),
  phone2: text("phone2"),
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  observacoes: text("observacoes"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // in minutes
  price: decimal("price", { precision: 10, scale: 2 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Technicians table
export const technicians = pgTable("technicians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  documento: text("documento").notNull(),
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  specialization: text("specialization"),
  observacoes: text("observacoes"),
  isActive: boolean("is_active").default(true).notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vehicles table
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  plate: text("plate").notNull(),
  model: text("model").notNull(),
  brand: text("brand").notNull(),
  year: integer("year").notNull(),
  technicianId: integer("technician_id").references(() => technicians.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  technicianId: integer("technician_id").references(() => technicians.id),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
  priority: text("priority").notNull().default("normal"), // normal, high, urgent
  notes: text("notes"),
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vehicle checklists table
export const checklists = pgTable("checklists", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id),
  technicianId: integer("technician_id").notNull().references(() => technicians.id),
  checkDate: timestamp("check_date").defaultNow().notNull(),
  items: text("items").notNull(), // JSON string of checklist items
  notes: text("notes"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business rules table
export const businessRules = pgTable("business_rules", {
  id: serial("id").primaryKey(),
  maximoParadasPorRota: integer("maximo_paradas_por_rota").notNull().default(10),
  horarioInicioTrabalho: text("horario_inicio_trabalho").notNull().default("08:00"),
  horarioFimTrabalho: text("horario_fim_trabalho").notNull().default("18:00"),
  tempoDeslocamentoBuffer: integer("tempo_deslocamento_buffer").notNull().default(15), // in minutes
  minutosEntreParadas: integer("minutos_entre_paradas").notNull().default(30),
  distanciaMaximaEntrePontos: decimal("distancia_maxima_entre_pontos", { precision: 8, scale: 2 }).notNull().default("50.00"), // in km
  enderecoEmpresaCep: text("endereco_empresa_cep").notNull(),
  enderecoEmpresaLogradouro: text("endereco_empresa_logradouro").notNull(),
  enderecoEmpresaNumero: text("endereco_empresa_numero").notNull(),
  enderecoEmpresaComplemento: text("endereco_empresa_complemento"),
  areaOperacao: text("area_operacao").notNull().default("Cidade"),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertChecklistSchema = createInsertSchema(checklists).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertBusinessRulesSchema = createInsertSchema(businessRules).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  enderecoEmpresaCep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX"),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// CEP validation schema
export const cepSchema = z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX");

// Client schema with extended validation
export const extendedInsertClientSchema = insertClientSchema.extend({
  cep: cepSchema,
  numero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos"),
});

// Technician schema with extended validation  
export const extendedInsertTechnicianSchema = insertTechnicianSchema.extend({
  cep: cepSchema,
  numero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos"),
});

// Appointment schema with extended validation
export const extendedInsertAppointmentSchema = insertAppointmentSchema.extend({
  cep: cepSchema,
  numero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos"),
  scheduledDate: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof extendedInsertAppointmentSchema>;
export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type BusinessRules = typeof businessRules.$inferSelect;
export type InsertBusinessRules = z.infer<typeof insertBusinessRulesSchema>;
export type LoginData = z.infer<typeof loginSchema>;
