import { pgTable, text, serial, integer, boolean, timestamp, decimal, uuid, jsonb, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies table - Empresas/Tenants do sistema multiempresa
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nome fantasia
  cnpj: text("cnpj").notNull().unique(),
  telefone: text("telefone").notNull(), // WhatsApp comercial
  email: text("email").notNull(),
  // Endereço da sede
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  cidade: text("cidade").notNull(),
  estado: text("estado").notNull(),
  // Segmento e marketing
  segmento: text("segmento"), // Assistência técnica, Telecom/Fibra, Elétrica/Hidráulica, etc.
  servicos: text("servicos").array(), // Instalação, Manutenção, Vistorias, Entregas/Coletas, etc.
  comoConheceu: text("como_conheceu"), // Instagram, YouTube, Google, Indicação, WhatsApp, Outro
  problemaPrincipal: text("problema_principal"), // Organização de agenda, Roteirização, Gestão de técnicos, etc.
  // Plano e status
  plan: text("plan").notNull().default("free"), // free, basic, professional, enterprise
  statusAssinatura: text("status_assinatura").notNull().default("active"), // active, suspended, cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Memberships table - Ligação entre usuários e empresas com seus papéis
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // ADMIN, ADMINISTRATIVO, OPERADOR
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Invitations table - Convites para usuários entrarem em empresas
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  email: text("email").notNull(),
  role: text("role").notNull(), // ADMIN, ADMINISTRATIVO, OPERADOR
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  expiresAt: timestamp("expires_at").notNull(),
  invitedBy: integer("invited_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("basic"), // basic, professional (herdado, pode ser descontinuado em favor de companies.plan)
  role: text("role").notNull().default("user"), // admin, user, operador (compatibilidade, preferir memberships.role)
  phone: text("phone"),
  cep: text("cep"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: text("estado"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  passwordChangedAt: timestamp("password_changed_at"), // Para invalidar tokens antigos
  requirePasswordChange: boolean("require_password_change").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  accessScheduleId: integer("access_schedule_id"), // Tabela de horário de acesso (opcional) - referência adicionada depois
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by"), // ID do admin que criou (rastreabilidade LGPD)
});

// Access Schedules table - Tabelas de horário de acesso à plataforma
export const accessSchedules = pgTable("access_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nome da tabela de horário (ex: "Comercial", "24/7", etc.)
  // Horários por dia da semana (formato JSON com início e fim)
  // Ex: { "monday": [{"start": "08:00", "end": "18:00"}], "tuesday": [...], ... }
  schedules: jsonb("schedules").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clients table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone1: text("phone1"),
  phone2: text("phone2"),
  cpf: text("cpf").notNull().unique(),
  cep: text("cep").notNull(),
  bairro: text("bairro").notNull(),
  cidade: text("cidade").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  observacoes: text("observacoes"),
  lat: doublePrecision("lat"),   // latitude (ex.: -25.4284)
  lng: doublePrecision("lng"),   // longitude (ex.: -49.2733)
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});


// Services table
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // in minutes
  price: decimal("price", { precision: 10, scale: 2 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  // Campo adicionado para pontos/remuneração conforme solicitado
  points: integer("points"), // Pontos/remuneração aceita apenas números
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
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
  bairro: text("bairro").notNull().default("Não informado"),
  cidade: text("cidade").notNull().default("Não informado"),
  estado: text("estado").notNull().default("Não informado"),
  specialization: text("specialization"),
  observacoes: text("observacoes"),
  serviceIds: text("service_ids").array(),
  // Endereço de Início Diário (opcional) - usado como ponto de partida na roteirização
  // Se não preenchido, será usado o endereço padrão da empresa
  enderecoInicioCep: text("endereco_inicio_cep"),
  enderecoInicioLogradouro: text("endereco_inicio_logradouro"),
  enderecoInicioNumero: text("endereco_inicio_numero"),
  enderecoInicioComplemento: text("endereco_inicio_complemento"),
  enderecoInicioBairro: text("endereco_inicio_bairro"),
  enderecoInicioCidade: text("endereco_inicio_cidade"),
  enderecoInicioEstado: text("endereco_inicio_estado"),
  // Horários de trabalho individuais do técnico
  horarioInicioTrabalho: text("horario_inicio_trabalho").default("08:00"),
  horarioFimTrabalho: text("horario_fim_trabalho").default("18:00"),
  horarioAlmocoMinutos: integer("horario_almoco_minutos").default(60), // Tempo de almoço em minutos
  diasTrabalho: text("dias_trabalho").array().default(['segunda', 'terca', 'quarta', 'quinta', 'sexta']), // Dias da semana que trabalha
  isActive: boolean("is_active").default(true).notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
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
  teamId: integer("team_id").references(() => teams.id),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  serviceId: integer("service_id").notNull().references(() => services.id),
  technicianId: integer("technician_id").references(() => technicians.id),
  teamId: integer("team_id").references(() => teams.id),
  scheduledDate: timestamp("scheduled_date").notNull(),
  allDay: boolean("all_day").default(false).notNull(), // Campo para eventos "dia todo"
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled, rescheduled
  priority: text("priority").notNull().default("normal"), // normal, high, urgent
  notes: text("notes"),
  // Novos campos para o fluxo de prestadores
  photos: jsonb("photos"), // Array de URLs das fotos
  signature: text("signature"), // URL ou base64 da assinatura
  feedback: text("feedback"), // Feedback do prestador sobre o serviço
  executionStatus: text("execution_status"), // concluido, nao_realizado_...
  executionNotes: text("execution_notes"), // Motivo/detalhes obrigatório se não for concluído
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  bairro: text("bairro").notNull().default("Não informado"),
  cidade: text("cidade").notNull().default("Não informado"),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
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
  distanciaMaximaAtendida: decimal("distancia_maxima_atendida", { precision: 8, scale: 2 }).notNull().default("100.00"), // in km
  distanciaMaximaEntrePontosDinamico: decimal("distancia_maxima_entre_pontos_dinamico", { precision: 8, scale: 2 }).notNull().default("50.00"), // in km
  enderecoEmpresaCep: text("endereco_empresa_cep").notNull(),
  enderecoEmpresaLogradouro: text("endereco_empresa_logradouro").notNull(),
  enderecoEmpresaNumero: text("endereco_empresa_numero").notNull(),
  enderecoEmpresaComplemento: text("endereco_empresa_complemento"),
  enderecoEmpresaBairro: text("endereco_empresa_bairro").notNull(),
  enderecoEmpresaCidade: text("endereco_empresa_cidade").notNull(),
  enderecoEmpresaEstado: text("endereco_empresa_estado").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Teams table - Nova tabela para equipes conforme solicitado
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Nome da equipe
  serviceIds: text("service_ids").array(), // IDs dos serviços que a equipe atende
  // Endereço de Início Diário (opcional) - usado como ponto de partida na roteirização
  // Se não preenchido, será usado o endereço padrão da empresa
  enderecoInicioCep: text("endereco_inicio_cep"),
  enderecoInicioLogradouro: text("endereco_inicio_logradouro"),
  enderecoInicioNumero: text("endereco_inicio_numero"),
  enderecoInicioComplemento: text("endereco_inicio_complemento"),
  enderecoInicioBairro: text("endereco_inicio_bairro"),
  enderecoInicioCidade: text("endereco_inicio_cidade"),
  enderecoInicioEstado: text("endereco_inicio_estado"),
  // Horários de trabalho individuais da equipe
  horarioInicioTrabalho: text("horario_inicio_trabalho").default("08:00"),
  horarioFimTrabalho: text("horario_fim_trabalho").default("18:00"),
  horarioAlmocoMinutos: integer("horario_almoco_minutos").default(60), // Tempo de almoço em minutos
  diasTrabalho: text("dias_trabalho").array().default(['segunda', 'terca', 'quarta', 'quinta', 'sexta']), // Dias da semana que trabalha
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team members table - Tabela para vincular técnicos às equipes
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  technicianId: integer("technician_id").notNull().references(() => technicians.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Routes table - Tabela principal de rotas otimizadas
export const routes = pgTable("routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 120 }).notNull(),
  date: timestamp("date", { withTimezone: false }).notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id),
  // responsável pode ser técnico OU equipe — usar union simples por tipo+id
  responsibleType: varchar("responsible_type", { length: 16 }).notNull(), // 'technician' | 'team'
  responsibleId: varchar("responsible_id", { length: 64 }).notNull(),
  endAtStart: boolean("end_at_start").notNull().default(false),
  distanceTotal: integer("distance_total").notNull().default(0), // em metros
  durationTotal: integer("duration_total").notNull().default(0), // em segundos
  stopsCount: integer("stops_count").notNull().default(0),
  status: varchar("status", { length: 24 }).notNull().default("draft"), // draft|confirmado|finalizado|cancelado
  polylineGeoJson: jsonb("polyline_geojson"), // GeoJSON LineString
  displayNumber: integer("display_number").notNull().default(0),
  userId: integer("user_id").references(() => users.id), // 🔒 Isolamento entre empresas (opcional até migration)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Route stops table - Paradas ordenadas (ligação rota → agendamentos)
export const routeStops = pgTable("route_stops", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeId: uuid("route_id").references(() => routes.id).notNull(),
  appointmentId: uuid("appointment_id").notNull(),
  order: integer("order").notNull(), // 1..N
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  address: text("address").notNull(),
  appointmentNumericId: integer("appointment_numeric_id"),
});

// Route audits table - Histórico de alterações nas rotas
export const routeAudits = pgTable("route_audits", {
  id: serial("id").primaryKey(),
  routeId: uuid("route_id").references(() => routes.id).notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 32 }).notNull(), // reorder, add_stop, remove_stop, optimize
  description: text("description").notNull(), // Descrição legível da ação
  metadata: jsonb("metadata"), // Dados extras opcionais (ex: endereços adicionados/removidos)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily availability table - Armazena disponibilidade calculada por dia/responsável
export const dailyAvailability = pgTable("daily_availability", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: timestamp("date", { withTimezone: false }).notNull(), // Data do dia
  responsibleType: varchar("responsible_type", { length: 16 }).notNull(), // 'technician' | 'team'
  responsibleId: integer("responsible_id").notNull(), // ID do técnico ou equipe
  totalMinutes: integer("total_minutes").notNull().default(0), // Total de minutos disponíveis no dia
  usedMinutes: integer("used_minutes").notNull().default(0), // Minutos usados em agendamentos
  availableMinutes: integer("available_minutes").notNull().default(0), // Minutos ainda disponíveis
  appointmentCount: integer("appointment_count").notNull().default(0), // Número de agendamentos
  status: varchar("status", { length: 16 }).notNull().default("available"), // available, partial, full, exceeded
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Date restrictions table - Restrições de datas (feriados/indisponibilidades) por técnico ou equipe
export const dateRestrictions = pgTable("date_restrictions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: timestamp("date", { withTimezone: false }).notNull(), // Data afetada pela restrição (somente dia)
  responsibleType: varchar("responsible_type", { length: 16 }).notNull(), // 'technician' | 'team'
  responsibleId: integer("responsible_id").notNull(), // ID do técnico ou equipe
  title: text("title").notNull(), // Motivo da restrição (feriado, treinamento, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, { fields: [routeStops.routeId], references: [routes.id] }),
}));

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
}).extend({
  brand: z.string().min(1, "Marca é obrigatória"),
  model: z.string().min(1, "Modelo é obrigatório"),
  year: z.number().min(1900, "Ano deve ser válido").max(new Date().getFullYear() + 1, "Ano não pode ser no futuro"),
}).refine(
  (d) => (d.technicianId ? !d.teamId : !!d.teamId),
  { message: "Selecione Técnico OU Equipe (apenas um)", path: ["technicianId"] }
);

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

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRouteStopSchema = createInsertSchema(routeStops).omit({
  id: true,
});

export const insertRouteAuditSchema = createInsertSchema(routeAudits).omit({
  id: true,
  createdAt: true,
});

export const insertDailyAvailabilitySchema = createInsertSchema(dailyAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDateRestrictionSchema = createInsertSchema(dateRestrictions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertAccessScheduleSchema = createInsertSchema(accessSchedules).omit({
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
  enderecoEmpresaBairro: z.string().min(1, "Bairro é obrigatório"),
  enderecoEmpresaCidade: z.string().min(1, "Cidade é obrigatória"),
  enderecoEmpresaEstado: z.string().min(2, "Estado é obrigatório"),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

// User management schemas (Admin)
export const createUserByAdminSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  username: z.string().min(3, "Username deve ter no mínimo 3 caracteres"),
  role: z.enum(["admin", "user", "operador"]),
  phone: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  accessScheduleId: z.number().optional().nullable(),
});

export const updateUserByAdminSchema = z.object({
  name: z.string().min(3).optional(),
  username: z.string().min(3).optional(),
  role: z.enum(["admin", "user", "operador"]).optional(),
  phone: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  isActive: z.boolean().optional(),
  accessScheduleId: z.number().optional().nullable(),
});

// Email verification schema
export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
});

// First password change schema
export const setFirstPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(8, "Nova senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Forgot password schema (solicitar recuperação)
export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

// Reset password schema (redefinir com token)
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// CEP validation schema
export const cepSchema = z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX");

// Client schema with extended validation
export const extendedInsertClientSchema = insertClientSchema.extend({
  cep: cepSchema,
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  numero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos"),
  phone1: z.string().min(1, "Telefone 1 é obrigatório").regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX"),
  phone2: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX").optional().or(z.literal("")),
  email: z.string().regex(/^[^@]*@[^@]*$/, "Email deve conter @").optional().or(z.literal("")),
});


// Technician schema with extended validation  
export const extendedInsertTechnicianSchema = insertTechnicianSchema.extend({
  cep: cepSchema,
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().min(2, "Estado é obrigatório"),
  numero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos"),
  serviceIds: z.array(z.string()).optional(),
  // Validações opcionais para endereço de início diário
  enderecoInicioCep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX").optional().or(z.literal("")),
  enderecoInicioNumero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos").optional().or(z.literal("")),
  // Campos adicionais de endereço de início diário  
  enderecoInicioBairro: z.string().optional(),
  enderecoInicioCidade: z.string().optional(),
  enderecoInicioEstado: z.string().optional(),
});

// Team schema with extended validation
export const extendedInsertTeamSchema = insertTeamSchema.extend({
  serviceIds: z.array(z.string()).optional(),
  // Validações opcionais para endereço de início diário - idêntico aos técnicos
  enderecoInicioCep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX").optional().or(z.literal("")),
  enderecoInicioNumero: z.string().regex(/^\d+$/, "Número deve conter apenas dígitos").optional().or(z.literal("")),
  enderecoInicioBairro: z.string().optional().or(z.literal("")),
  enderecoInicioCidade: z.string().optional().or(z.literal("")),
  enderecoInicioEstado: z.string().optional().or(z.literal("")),
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
  // Validação dos novos campos opcionais
  photos: z.array(z.string()).optional().nullable(),
  signature: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  executionStatus: z.string().optional().nullable(),
  executionNotes: z.string().optional().nullable(),
}).refine((data) => {
  // Pelo menos um responsável deve ser selecionado (técnico ou equipe)
  return data.technicianId || data.teamId;
}, {
  message: "Selecione um técnico ou equipe responsável",
  path: ["technicianId"],
});

// Multiempresa schemas
export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
});

// Roles enum para multiempresa
export const roleEnum = z.enum(["ADMIN", "ADMINISTRATIVO", "OPERADOR"]);

// Schema para cadastro de nova empresa + admin
export const signupCompanySchema = z.object({
  // Dados da empresa
  company: z.object({
    name: z.string().min(3, "Nome da empresa deve ter no mínimo 3 caracteres"),
    cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX"),
    telefone: z.string().min(10, "Telefone é obrigatório"),
    email: z.string().email("Email da empresa inválido"),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP deve estar no formato XXXXX-XXX"),
    logradouro: z.string().min(3, "Logradouro é obrigatório"),
    numero: z.string().min(1, "Número é obrigatório"),
    cidade: z.string().min(2, "Cidade é obrigatória"),
    estado: z.string().length(2, "Estado deve ter 2 caracteres"),
    segmento: z.string().optional(),
    servicos: z.array(z.string()).optional(),
    comoConheceu: z.string().optional(),
    problemaPrincipal: z.string().optional(),
  }),
  // Dados do administrador
  admin: z.object({
    name: z.string().min(3, "Nome do administrador deve ter no mínimo 3 caracteres"),
    email: z.string().email("Email do administrador inválido"),
    phone: z.string().min(10, "Telefone do administrador é obrigatório"),
  }),
});

// Schema para criar convite
export const createInvitationSchema = z.object({
  email: z.string().email("Email inválido"),
  role: roleEnum,
});

// Schema para aceitar convite (usuário novo)
export const acceptInvitationNewUserSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres")
    .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
    .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
    .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Schema para aceitar convite (usuário existente)
export const acceptInvitationExistingUserSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
});

// Types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type SignupCompanyData = z.infer<typeof signupCompanySchema>;
export type CreateInvitationData = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationNewUserData = z.infer<typeof acceptInvitationNewUserSchema>;
export type AcceptInvitationExistingUserData = z.infer<typeof acceptInvitationExistingUserSchema>;
export type RoleType = z.infer<typeof roleEnum>;

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
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type RouteStop = typeof routeStops.$inferSelect;
export type InsertRouteStop = z.infer<typeof insertRouteStopSchema>;
export type RouteAudit = typeof routeAudits.$inferSelect;
export type InsertRouteAudit = z.infer<typeof insertRouteAuditSchema>;
export type DailyAvailability = typeof dailyAvailability.$inferSelect;
export type InsertDailyAvailability = z.infer<typeof insertDailyAvailabilitySchema>;
export type DateRestriction = typeof dateRestrictions.$inferSelect;
export type InsertDateRestriction = z.infer<typeof insertDateRestrictionSchema>;
export type AccessSchedule = typeof accessSchedules.$inferSelect;
export type InsertAccessSchedule = z.infer<typeof insertAccessScheduleSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type CreateUserByAdmin = z.infer<typeof createUserByAdminSchema>;
export type UpdateUserByAdmin = z.infer<typeof updateUserByAdminSchema>;
export type VerifyEmailData = z.infer<typeof verifyEmailSchema>;
export type SetFirstPasswordData = z.infer<typeof setFirstPasswordSchema>;
export type ChangePasswordData = z.infer<typeof changePasswordSchema>;
