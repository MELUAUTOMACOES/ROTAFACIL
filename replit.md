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
- June 14, 2025. Initial setup
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```