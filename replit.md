# CRM Professional System

## Overview

This is a full-stack Customer Relationship Management (CRM) application built with a modern tech stack. The system provides comprehensive functionality for managing companies, contacts, deals, and activities in a professional business environment.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon serverless PostgreSQL
- **Authentication**: Replit Auth with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage

### Monorepo Structure
The application uses a monorepo structure with shared schemas:
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Shared TypeScript schemas and types

## Key Components

### Authentication System
- **Provider**: Replit Auth integration with OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Authorization**: Role-based access control (admin/user roles)
- **Security**: HTTP-only cookies with secure flags

### Database Schema
The system uses PostgreSQL with the following main entities:
- **Users**: Authentication and profile information
- **Companies**: Business entities with sector and location data
- **Contacts**: Individual contacts linked to companies
- **Deals**: Sales opportunities with stages and values
- **Activities**: Tasks and interactions with due dates and completion status
- **Sessions**: Authentication session storage

### API Design
RESTful API endpoints organized by resource:
- `/api/auth/*` - Authentication endpoints
- `/api/companies/*` - Company management
- `/api/contacts/*` - Contact management
- `/api/deals/*` - Deal/pipeline management
- `/api/activities/*` - Activity tracking
- `/api/dashboard/*` - Dashboard metrics and analytics

### UI/UX Architecture
- **Design System**: shadcn/ui with New York variant
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Navigation**: Sidebar layout with role-based menu items
- **Forms**: React Hook Form with Zod validation
- **Data Display**: Tables, cards, and kanban-style pipeline views

## Data Flow

### Client-Server Communication
1. Frontend makes API requests using fetch with credentials
2. Express middleware handles authentication and request logging
3. Drizzle ORM executes database queries
4. Response data flows back through the middleware chain
5. React Query caches and manages server state on the client

### Authentication Flow
1. User initiates login via `/api/login` endpoint
2. Replit Auth handles OpenID Connect flow
3. User session created and stored in PostgreSQL
4. Frontend receives authenticated user data
5. Subsequent requests include session cookies for authorization

### Form Submission Flow
1. Forms use React Hook Form with Zod schema validation
2. Client-side validation prevents invalid submissions
3. Valid data sent to appropriate API endpoints
4. Server validates using shared Zod schemas
5. Database operations performed via Drizzle ORM
6. Success/error responses trigger UI updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **drizzle-orm**: TypeScript ORM for database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/react-***: Accessible UI component primitives
- **openid-client**: OpenID Connect authentication
- **express-session**: Session management middleware

### Development Tools
- **Vite**: Development server and build tool
- **TypeScript**: Type safety and development experience
- **Tailwind CSS**: Utility-first CSS framework
- **React Hook Form**: Form state management
- **Zod**: Schema validation library

### Replit-Specific Integrations
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling
- **Replit Auth**: Integrated authentication system

## Deployment Strategy

### Development Environment
- Vite development server with HMR
- Express server with TypeScript compilation via tsx
- Environment variables for database and authentication configuration
- Replit-specific development banners and tooling

### Production Build
- Frontend: Vite builds optimized React bundle to `dist/public`
- Backend: esbuild compiles TypeScript server to `dist/index.js`
- Static file serving: Express serves built frontend assets
- Database migrations: Drizzle Kit handles schema changes

### Environment Configuration
- `DATABASE_URL`: Neon PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OpenID Connect issuer (defaults to Replit)
- `REPLIT_DOMAINS`: Allowed domains for OIDC

## Changelog

```
Changelog:
- June 28, 2025. Initial setup
- June 28, 2025. Fixed pipeline creation bugs: corrected pipelineId parameter passing, defaultStage handling, and API request parameter order in DealForm and KanbanBoard components
- June 28, 2025. Added comprehensive pipeline management: edit and delete functionality with confirmation dialogs, improved UI with management buttons for selected pipelines
- June 28, 2025. Fixed pipeline isolation bug: implemented proper pipeline-specific data filtering, cache invalidation with pipeline ID keys, and clean default stage creation for new pipelines without duplication
- June 28, 2025. Implemented complete drag-and-drop kanban functionality: using react-beautiful-dnd library with visual feedback (rotation and shadow effects), automatic stage updates via API, success/error notifications, and smooth user interaction for moving deals between pipeline stages
- June 28, 2025. Implemented comprehensive Role-Based Access Control (RBAC) system with 5 distinct roles (Admin, Gestor, Vendedor, Financeiro, Externo), each with specific permissions for granular access control across all CRM resources
- July 01, 2025. CRITICAL FIX: Resolved stage reordering bug caused by Express route conflicts. The endpoint `/api/pipeline-stages/positions` was being intercepted by `/api/pipeline-stages/:id` which interpreted "positions" as an ID. Fixed by reordering routes so specific paths come before parameterized ones. Also removed duplicate method implementations in storage layer that were causing additional conflicts.
- July 02, 2025. Complete Apple-style UI/UX Redesign: Implemented comprehensive visual redesign with Apple's minimalist aesthetic using black, white, and Apple blue color scheme. Updated all components including sidebar, dashboard, kanban board, cards, buttons, and typography. Applied Apple-style spacing, rounded corners, shadows, and transitions throughout the entire application while maintaining all existing functionality.
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```