# GEMINI.md - Project Context for Home Decoration Platform

This document provides essential context for the "Home Decoration" project, a full-stack monorepo application.

---

## 1. Project Overview

This is a comprehensive home decoration platform designed to connect homeowners, designers, and contractors. The project is structured as a monorepo containing three main components: a Go-based backend, a React-based admin panel, and a React Native mobile application.

### Technology Stack

- **Backend (`server/`):**
  - **Language/Framework:** Go (v1.21) with Gin
  - **Database:** PostgreSQL (with GORM) and Redis
  - **API:** RESTful API and WebSocket for real-time communication
  - **Configuration:** Viper (`config.yaml`)

- **Admin Panel (`admin/`):**
  - **Framework:** React (v19) with Vite
  - **Language:** TypeScript
  - **UI:** Ant Design and Ant Design Pro Components
  - **State Management:** Zustand

- **Mobile App (`mobile/`):**
  - **Framework:** React Native (v0.83)
  - **Language:** TypeScript
  - **Target Platforms:** iOS, Android, and Web (using Vite)
  - **State Management:** Zustand
  - **Navigation:** React Navigation

- **Containerization & Deployment:**
  - **Local Environment:** Docker and Docker Compose
  - **Orchestration:** Nginx serves as a reverse proxy for frontend and backend services in production.

---

## 2. Building and Running

The recommended method for local development is using Docker Compose, which orchestrates all the necessary services.

### 2.1. Recommended: Docker Compose

This approach starts the backend API, admin frontend, mobile web frontend, PostgreSQL database, and Redis.

**Command:**
From the project root, run:
```powershell
docker-compose -f docker-compose.local.yml up -d --build
```
*(For Windows users, `docker_start.bat` automates this.)*

**Access URLs:**
- **Admin Panel:** [http://localhost:5173](http://localhost:5173)
- **Mobile App (Web):** [http://localhost:5174](http://localhost:5174)
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **Database (PostgreSQL):** `localhost:5432` (User: `postgres`, Pass: `123456`)
- **Cache (Redis):** `localhost:6380`

### 2.2. Manual Setup (Alternative)

If you prefer to run services manually outside of Docker:

- **Backend Server (with hot-reload):**
  ```powershell
  cd server
  # Requires 'air' to be installed (go install github.com/cosmtrek/air@latest)
  make dev
  ```

- **Admin Panel:**
  ```powershell
  cd admin
  npm install
  npm run dev
  ```

- **Mobile App (Web):**
  ```powershell
  cd mobile
  npm install
  npm run web
  ```

- **Mobile App (Native):**
  ```powershell
  cd mobile
  npm install
  npm run android
  # or
  npm run ios
  ```

---

## 3. Development Conventions

- **Monorepo Structure:** The project is divided into `server`, `admin`, and `mobile` directories, each functioning as a standalone project.
- **Backend Architecture:** The Go backend follows a modular structure (`internal/handler`, `internal/service`, `internal/repository`) to separate concerns.
- **Hot Reloading:** The development environment is configured for rapid iteration.
  - The Go backend uses `air` for live recompilation.
  - The React frontends use Vite's Hot Module Replacement (HMR).
- **Database Migrations:** SQL migration files are located in `server/scripts/migrations/`.
- **API Documentation:** API contracts are documented in `server/docs/API接口文档.md`.
- **State Management:** Both frontends use `Zustand` for simple, effective global state management.
- **Code Formatting:**
  - **Go:** Run `make fmt` in the `server` directory.
  - **TypeScript/JS:** Run `npm run lint` in the `admin` and `mobile` directories.
