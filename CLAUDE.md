# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **home decoration platform** (装修设计一体化平台) that connects homeowners with designers, construction companies, foremen, and workers. The platform includes:
- **Mobile app** (React Native) - homeowner interface
- **Admin panel** (React + Ant Design) - management dashboard
- **Backend API** (Go + Gin) - REST API with WebSocket support
- **Database** - PostgreSQL with Redis caching

## Repository Structure

```
├── server/          # Go backend (Gin + GORM + PostgreSQL)
├── mobile/          # React Native app (iOS/Android + web via Vite)
├── admin/           # Admin panel (React + Vite + Ant Design)
├── docs/            # Product documentation (PRD, design specs)
├── deploy/          # Deployment configs (Docker, Nginx)
└── db_data_local/   # Local PostgreSQL data (gitignored)
```

## Development Commands

### Local Development Setup (Recommended)

Start all services with Docker Compose:
```bash
docker-compose -f docker-compose.local.yml up -d
```

Rebuild backend API only:
```bash
docker-compose -f docker-compose.local.yml build --no-cache api
```

Start database and Redis only:
```bash
docker compose up -d db redis
```

### Backend (Go)

Run server directly:
```bash
cd server
go run ./cmd/api
```

Build:
```bash
cd server
make build
```

Development with hot reload (requires [air](https://github.com/cosmtrek/air)):
```bash
cd server
make dev
```

Run tests:
```bash
cd server
make test
```

Format code:
```bash
cd server
make fmt
```

Lint:
```bash
cd server
make lint
```

### Admin Panel (React + Vite)

Development server:
```bash
cd admin
npm run dev
```

Build:
```bash
cd admin
npm run build
```

Lint:
```bash
cd admin
npm run lint
```

### Mobile App (React Native)

**Web development** (Vite):
```bash
cd mobile
npm run web
```

**Metro bundler** (for React Native):
```bash
cd mobile
npm start
```

**Android**:
```bash
cd mobile
npm run android
```

**iOS**:
```bash
cd mobile
npm run ios
```

Build for web:
```bash
cd mobile
npm run build
```

### Android Debugging with ADB

Enable Metro bundler access from Android device:
```bash
adb reverse tcp:8081 tcp:8081
```

Enable backend API access from Android device:
```bash
adb reverse tcp:8080 tcp:8080
```

## Architecture

### Backend Architecture (Go)

**Framework**: Gin web framework with layered architecture

**Structure**:
- `cmd/api/main.go` - Entry point, initializes DB, WebSocket hub, and router
- `internal/config/` - Configuration management (Viper)
- `internal/handler/` - HTTP handlers (controllers)
- `internal/service/` - Business logic layer (user_service.go, provider_service.go, etc.)
- `internal/repository/` - Data access layer (GORM)
- `internal/model/` - Database models and entities
- `internal/router/` - Route definitions (router.go)
- `internal/middleware/` - Middleware (CORS, JWT auth, logging, recovery)
- `internal/ws/` - WebSocket implementation (hub, handler for real-time chat)
- `pkg/` - Shared utilities (response formatting, helpers)
- `scripts/` - SQL seed scripts for test data

**Key Models** (see `internal/model/model.go`):
- User, Provider (designers/companies/foremen), Worker
- Project, ProjectPhase, PhaseTask, Milestone
- EscrowAccount, Transaction (escrow payment system)
- Booking, ProviderCase, ProviderReview
- MaterialShop, Chat (WebSocket messages)
- Admin, Role, Menu (RBAC system)

**Authentication**: JWT-based auth with middleware at `/api/v1/auth/*`

**WebSocket**: Real-time chat via `/api/v1/ws` endpoint (requires JWT)

**Database**: PostgreSQL with GORM ORM. Connection initialized in `repository/database.go`

### Admin Panel Architecture (React)

**Framework**: React 19 + TypeScript + Vite + Ant Design Pro Components

**State Management**: Zustand (see `admin/src/stores/`)

**Routing**: React Router v7 with `/admin` basename
- Routes defined in `admin/src/router.tsx`
- Nested under `BasicLayout` component

**Key Pages**:
- Dashboard - statistics and trends
- User management - users and admins
- Provider management - designers, companies, foremen (with verification)
- Material shop management - showrooms and brands
- Project management - list view and map view
- Booking, Review, Audit management
- Finance - escrow accounts and transactions
- Risk - warnings and arbitration
- System settings, operation logs
- RBAC - roles and menus

**API Client**: Axios (`admin/src/services/api.ts`)

### Mobile App Architecture (React Native)

**Framework**: React Native 0.83 + TypeScript

**Navigation**:
- `@react-navigation/native-stack` for stack navigation
- `@react-navigation/bottom-tabs` for bottom tabs
- Main tabs: Home, Inspiration, Progress, Message, Profile

**State Management**: Zustand
- `authStore` - authentication state
- `providerStore` - provider data (designers, companies, foremen)
- `chatStore` - WebSocket chat integration

**Web Support**: App can run as web app via Vite (`npm run web`)

**Key Screens**:
- HomeScreen - browse providers
- InspirationScreen - design inspiration feed
- MessageScreen - chat conversations
- MySiteScreen - project progress tracking
- ProfileScreen - user profile and settings
- ProviderDetails - designer/worker/company details
- BookingScreen - appointment booking
- ProjectTimelineScreen - construction timeline
- ChatRoomScreen - real-time chat (WebSocket)

**Security**: Uses `react-native-keychain` for secure token storage (`mobile/src/utils/SecureStorage.ts`)

**WebSocket**: Connects to backend `/api/v1/ws` when authenticated (see `mobile/src/services/WebSocketService.ts`)

## Important Technical Notes

### Backend

1. **Route Organization**: All routes defined in `internal/router/router.go`
   - Public routes: `/api/v1/auth/*`, `/api/v1/providers`, `/api/v1/material-shops`
   - Authenticated routes: Use JWT middleware
   - Admin routes: `/api/v1/admin/*` (separate RBAC authorization)

2. **Service Layer Pattern**: Business logic lives in `internal/service/`, not handlers
   - Example: `provider_service.go`, `user_service.go`, `escrow_service.go`

3. **WebSocket Flow**:
   - Hub runs as goroutine in main.go
   - Clients connect via JWT-authenticated endpoint
   - Messages handled by `ws.Handler` which interacts with DB

4. **Database Seeding**: Test data scripts in `server/scripts/`:
   - `init_admin_data.sql` - seed admin users
   - `seed_test_data.sql` - seed providers, projects
   - `seed_rbac.go` - RBAC roles and menus

5. **Configuration**: Environment variables override `config.yaml`:
   - DATABASE_HOST, DATABASE_PORT, DATABASE_USER, etc.
   - REDIS_HOST, REDIS_PORT
   - JWT_SECRET

### Frontend (Admin + Mobile)

1. **API Base URL**:
   - Admin: Uses environment variable `VITE_API_URL`
   - Mobile: Hardcoded in `mobile/src/services/api.ts`
   - Default: `http://localhost:8080/api/v1`

2. **Admin Routing**: All admin routes have `/admin` basename (see `router.tsx`)

3. **Mobile Dual Platform**:
   - Native: React Native components + navigation
   - Web: Same code runs in browser via Vite + react-native-web
   - Icons: Uses `lucide-react-native` (compatible with both)

4. **State Persistence**:
   - Admin: Browser localStorage
   - Mobile Native: `@react-native-async-storage/async-storage`
   - Mobile tokens: Encrypted keychain storage

5. **Authentication Flow**:
   - Login returns JWT token
   - Token stored securely (keychain on mobile, localStorage on admin)
   - Token sent in `Authorization: Bearer <token>` header
   - WebSocket connects after auth with token in query params

## Common Development Patterns

### Adding a New Backend Endpoint

1. Define model in `internal/model/` if needed
2. Add business logic in `internal/service/`
3. Create handler in `internal/handler/`
4. Register route in `internal/router/router.go`
5. Test with seed data scripts

### Adding a New Admin Page

1. Create component in `admin/src/pages/{category}/{PageName}.tsx`
2. Add route in `admin/src/router.tsx`
3. Update sidebar menu in `admin/src/layouts/BasicLayout.tsx`
4. Add API calls in `admin/src/services/api.ts`
5. Manage state with Zustand store if complex

### Adding a New Mobile Screen

1. Create screen in `mobile/src/screens/{ScreenName}.tsx`
2. Register in `mobile/src/navigation/AppNavigator.tsx`
3. Add to Stack.Navigator (authenticated or unauthenticated)
4. Update store in `mobile/src/store/` if needed
5. Add API integration via `mobile/src/services/api.ts`

## Database Schema Notes

- All models inherit `Base` struct (ID, CreatedAt, UpdatedAt)
- Soft deletes not implemented - use status fields instead
- JSON fields stored as text (JSONB for PostgreSQL)
- Foreign keys use GORM conventions (e.g., `UserID` references `users.id`)
- Indexes defined via GORM tags: `gorm:"index"`, `gorm:"uniqueIndex"`

## WebSocket Protocol

Messages sent to `/api/v1/ws`:
```json
{
  "type": "message",
  "recipientId": 123,
  "content": "Hello",
  "messageType": "text"
}
```

Server broadcasts to recipient and sender.

## Documentation

Comprehensive docs in `docs/` directory:
- `PRD.md` - Product requirements
- `Frontend_Design.md` - Frontend architecture
- `Backend_Design.md` - Backend architecture
- `UI_UX_Design.md` - Design system
- `Database_Design.md` - Schema design
- `1.md` - Quick start commands (Chinese)

Refer to these docs for detailed product context before making architectural changes.
