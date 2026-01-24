# Project Management Specification

## Overview
Project management system handles construction projects from creation to completion with milestone-based progress tracking.

## ADDED Requirements

### Requirement: Project Creation
Homeowners SHALL be able to create projects and assign them to providers.

#### Scenario: Create new project
- GIVEN an authenticated homeowner
- WHEN the homeowner creates a project with provider
- THEN the system creates a Project record
- AND links to owner (User) and provider (Provider)
- AND initializes project status to 0 (pending)
- AND creates escrow account for the project

### Requirement: Project Phases and Milestones
Projects SHALL be divided into phases with milestone-based payments.

#### Scenario: Define project milestones
- GIVEN a new project
- WHEN milestones are defined (e.g., 水电, 泥瓦, 木工, 油漆, 竣工)
- THEN each milestone has a sequence number, amount, and percentage
- AND milestones must be accepted in order (seq 1, then 2, then 3...)
- AND payment is released upon milestone acceptance

### Requirement: Milestone Acceptance
Homeowners SHALL accept milestones to trigger payment release.

#### Scenario: Accept milestone
- GIVEN a project with milestone seq=1 in pending status
- WHEN the homeowner accepts the milestone
- THEN the system sets milestone status to accepted
- AND releases payment from escrow to provider
- AND updates project progress
- AND notifies provider

### Requirement: Work Logs
Daily work logs with photos SHALL track project progress.

#### Scenario: Create work log
- GIVEN an active project
- WHEN a work log is created with photos
- THEN the system stores the log with date and description
- AND optionally runs AI analysis on photos
- AND flags compliance issues if detected

## Data Models

### Project
- **ID**: uint64
- **OwnerID**: uint64 (homeowner)
- **ProviderID**: uint64 (service provider)
- **Name**: string
- **Address**: string
- **Latitude/Longitude**: float64
- **Area**: float64 (square meters)
- **Budget**: float64
- **Status**: int8 (0:pending, 1:active, 2:completed, 3:cancelled)
- **CurrentPhase**: string
- **StartDate/ExpectedEnd/ActualEnd**: timestamps

### Milestone
- **ID**: uint64
- **ProjectID**: uint64
- **Name**: string (水电, 泥瓦, etc.)
- **Seq**: int8 (sequence order)
- **Amount**: float64
- **Percentage**: float32
- **Status**: int8 (0:pending, 1:submitted, 2:accepted, 3:paid)
- **Criteria**: text (acceptance criteria)
- **SubmittedAt/AcceptedAt/PaidAt**: timestamps

### WorkLog
- **ID**: uint64
- **ProjectID**: uint64
- **PhaseID**: uint64
- **WorkerID**: uint64 (optional)
- **CreatedBy**: uint64 (admin/foreman)
- **Title**: string
- **LogDate**: date
- **Description**: text
- **Photos**: jsonb (array of URLs)
- **AIAnalysis**: jsonb (AI-detected issues)
- **IsCompliant**: bool
- **Issues**: jsonb (compliance issues)

## API Endpoints

### POST /api/v1/projects
- **Description**: Create project
- **Middleware**: JWT (homeowner)
- **Request Body**: Project details
- **Response**: Created project with escrow account

### GET /api/v1/projects/:id
- **Description**: Get project details
- **Middleware**: JWT
- **Response**: Project with milestones and work logs

### POST /api/v1/projects/:id/milestones/:milestoneId/accept
- **Description**: Accept milestone
- **Middleware**: JWT (project owner only)
- **Response**: Updated milestone and transaction record

### POST /api/v1/projects/:id/work-logs
- **Description**: Create work log
- **Middleware**: JWT (provider/admin)
- **Request Body**: Log details with photos
- **Response**: Created work log

### GET /api/v1/projects/:id/timeline
- **Description**: Get project timeline
- **Response**: Chronological list of milestones and work logs

## Business Rules

1. Milestones must be accepted in sequence order
2. Payment is released only after milestone acceptance
3. Project owner must be the homeowner who created it
4. Only provider or admin can create work logs
5. Project status changes trigger notifications
6. Escrow account is created automatically with project

## Security Considerations

1. Only project owner can accept milestones
2. Only provider/admin can create work logs
3. Milestone acceptance triggers financial transaction (must be atomic)
4. Work log photos stored securely in OSS

## Dependencies

- User management for owners and providers
- Escrow system for milestone payments
- Notification system for status changes
- File storage (OSS) for work log photos
- AI service for photo analysis (optional)
