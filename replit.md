# RotaFácil - Service Route Management System

## Overview

RotaFácil is a comprehensive service route management application designed to help businesses optimize their field service operations. The system provides tools for managing appointments, technicians, vehicles, clients, and automated route optimization. Built with a modern full-stack architecture using React, Express, and PostgreSQL.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom color scheme
- **State Management**: TanStack Query for server state, React Context for auth
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js 20
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: JWT-based with bcrypt for password hashing
- **API Pattern**: RESTful endpoints with consistent error handling
- **Development**: Hot reload with tsx, production build with esbuild

### Database Architecture
- **Database**: PostgreSQL 16 via Neon Serverless
- **Schema Management**: Drizzle Kit for migrations
- **Connection**: Neon serverless driver with WebSocket support
- **Tables**: Users, Clients, Services, Technicians, Vehicles, Appointments, Checklists, BusinessRules

## Key Components

### Authentication System
- JWT-based authentication with secure token storage
- User registration and login with email/password
- Protected routes with middleware authentication
- Role-based access (basic/professional plans)

### Core Entities Management
- **Clients**: Customer information with address details
- **Services**: Service catalog with pricing and duration
- **Technicians**: Field worker profiles with availability
- **Vehicles**: Fleet management with technician assignments
- **Appointments**: Service bookings with scheduling

### Route Optimization
- Appointment selection for route planning
- Distance and time calculation algorithms
- Multi-stop route optimization
- Real-time route adjustments

### Business Rules Engine
- Configurable working hours and buffer times
- Maximum stops per route limitations
- Geographic operation area definitions
- Service duration and pricing rules

## Data Flow

1. **User Authentication**: Login → JWT token → Stored in localStorage → Attached to API requests
2. **Data Management**: React components → TanStack Query → Express APIs → Drizzle ORM → PostgreSQL
3. **Route Planning**: Select appointments → Calculate distances → Optimize order → Generate route
4. **Real-time Updates**: Form submissions → API calls → Database updates → UI refresh via query invalidation

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL connection
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI component primitives
- **drizzle-orm**: Type-safe database ORM
- **wouter**: Lightweight React router
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT authentication

### Development Tools
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety across the stack
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Production bundling
- **Drizzle Kit**: Database migration tool

## Deployment Strategy

### Replit Configuration
- **Runtime**: Node.js 20 with PostgreSQL 16 module
- **Development**: `npm run dev` starts both frontend and backend
- **Production Build**: Vite builds frontend, esbuild bundles backend
- **Port Configuration**: Backend on 5000, proxied to port 80
- **Auto-scaling**: Configured for Replit's autoscale deployment

### Environment Setup
- Database provisioning via Replit's PostgreSQL module
- Environment variables managed through Replit secrets
- Hot reload enabled for development workflow
- Production-ready bundling with tree-shaking

### Build Process
1. Frontend: Vite builds React app to `dist/public`
2. Backend: ESBuild bundles Express server to `dist/index.js`
3. Static assets served by Express in production
4. Database migrations run via `npm run db:push`

## Changelog
```
Changelog:
- July 17, 2025: Migration from Replit Agent to Replit Environment
  * Fixed port configuration from 5050 to 5000 for proper deployment
  * Added automatic redirect to /dashboard after successful login
  * Updated server binding to use 0.0.0.0 for accessibility
  * Verified all dependencies and workflows are functioning correctly
  * Completed full project migration with security best practices
- June 27, 2025: Correções na tela de agendamentos
  * Corrigido erro "toISOString is not a function" com logs detalhados para identificar dados problemáticos
  * Implementada limpeza completa do formulário ao clicar "Novo Agendamento"
  * Adicionada vinculação de técnicos via equipe nos cards de agendamentos
  * Logs de debug implementados em todos os fluxos de correção
- June 27, 2025: Atualização completa do modelo CSV de agendamentos
  * Removido campo "ID" do modelo CSV de agendamentos
  * Adicionado campo "CPF Cliente" como segunda coluna no modelo
  * Implementado comportamento inteligente: se CPF já existe, puxa dados do cliente cadastrado
  * Adicionados logs detalhados para importação CSV indicando campos reconhecidos
  * Documentação atualizada com nova ordem de campos e comportamento de CPF
  * Campos obrigatórios: Cliente, Serviço, Data/Hora, CEP, Logradouro, Número
- June 27, 2025: Ajustes completos no fluxo "Ache uma Data" → "Novo Agendamento"
  * Campo "Técnico" renomeado para "Técnico/Equipe" na tela FindDate
  * Técnicos e equipes agora aparecem juntos no campo de seleção de filtros
  * Implementado pré-preenchimento de todos os campos do cliente quando selecionado
  * Campos Cliente, Serviço, Técnico/Equipe, Data, CEP, Número, Logradouro e Complemento desabilitados no formulário quando vindos do fluxo FindDate
  * Apenas Status, Prioridade e Observações podem ser editados no cenário de busca
  * Adicionados logs de debug em todas as etapas do fluxo para facilitar manutenção
  * Correção de validação de parâmetros URL com suporte a teamId e clientId
- June 24, 2025: Correção completa do formulário de equipes (TeamForm)
  * Refatorado TeamForm para seguir padrão do TechnicianForm
  * Corrigido botão de atualização que estava criando equipes em vez de atualizar
  * Implementado pré-preenchimento correto dos dados da equipe
  * Adicionadas validações de email (@) e telefone formatado automaticamente
  * Melhorado layout com scroll controlado e diálogos responsivos
  * Corrigida vinculação de técnicos às equipes
  * Bloqueio de submissões vazias em modo criação
  * Documentação criada em README-EQUIPES-FIX.md
- June 15, 2025: Ajustes no site institucional conforme especificações
  * Removido botão "Login" dos menus, mantido apenas "Acessar Sistema"
  * Alterada imagem do slide "Economia de Recursos" para logística
  * Ajustado texto do card "Gerencie sua frota" para "tudo em um único lugar"
  * Substituído card "Manutenção de Veículos" por "Encontre uma data"
  * Removido card "Gerenciamento de Funcionários e Veículos"
  * Tabela "Compare os Planos" expandida para 4 colunas (Básico, Profissional, Empresarial, Personalizado)
  * Atualizados dados dos planos com novas especificações de requisições, veículos e técnicos
  * Seção "Planos e Preços" sincronizada com tabela comparativa
- June 15, 2025: Criado site institucional moderno com página Home completa
  * Implementada página Home com carrossel hero, seções de funcionalidades e preços
  * Navegação responsiva com menu mobile 
  * Design seguindo visual das imagens de referência fornecidas
  * Integração com sistema de login existente
- June 14, 2025: Initial setup
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```