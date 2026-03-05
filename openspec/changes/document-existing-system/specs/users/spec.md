# User Management Specification

## Overview
User management system handles homeowners, service providers, workers, and administrators with role-based access control.

## ADDED Requirements

### Requirement: User Types and Roles
The system SHALL support four user types with different permissions and capabilities.

#### Scenario: Homeowner user registration
- GIVEN a new user wants to register as a homeowner
- WHEN the user submits phone and password
- THEN the system creates a User record with `userType=1` (homeowner)
- AND hashes the password using bcrypt
- AND returns JWT tokens

#### Scenario: Service provider user creation
- GIVEN an approved merchant application
- WHEN the system processes the approval
- THEN it creates a User record with `userType=2` (provider)
- AND creates a linked Provider record
- AND sends approval notification

### Requirement: User Profile Management
Users SHALL be able to view and update their profile information.

#### Scenario: User updates profile
- GIVEN an authenticated user
- WHEN the user updates nickname and avatar
- THEN the system validates the input
- AND updates the User record
- AND returns the updated profile

### Requirement: User Status Management
Administrators SHALL be able to manage user account status.

#### Scenario: Admin bans a user
- GIVEN an admin user
- WHEN the admin sets user status to 0 (banned)
- THEN the user cannot log in
- AND existing tokens are invalidated
- AND the user receives a ban notification

## Data Models

### User
- **ID**: uint64 (primary key)
- **Phone**: string (unique, indexed)
- **Nickname**: string
- **Avatar**: string (URL)
- **Password**: string (hashed, never exposed)
- **UserType**: int8 (1:homeowner, 2:provider, 3:worker, 4:admin)
- **Status**: int8 (0:banned, 1:active)
- **LoginFailedCount**: int
- **LockedUntil**: timestamp
- **LastFailedLoginAt**: timestamp

## API Endpoints

### GET /api/v1/user/profile
- **Description**: Get current user profile
- **Middleware**: JWT
- **Response**: User object (password excluded)

### PUT /api/v1/user/profile
- **Description**: Update user profile
- **Middleware**: JWT
- **Request Body**: `{ "nickname": "...", "avatar": "..." }`
- **Response**: Updated user object

### GET /api/v1/admin/users
- **Description**: List all users (admin only)
- **Middleware**: AdminJWT
- **Query Params**: page, limit, userType, status
- **Response**: Paginated user list

### PUT /api/v1/admin/users/:id/status
- **Description**: Update user status (admin only)
- **Middleware**: AdminJWT, RequirePermission("user:manage")
- **Request Body**: `{ "status": 0 }`
- **Response**: Updated user object

## Business Rules

1. Phone numbers must be unique across all users
2. Passwords must be at least 6 characters
3. User type cannot be changed after creation
4. Banned users (status=0) cannot log in
5. Admin users require additional RBAC permissions

## Security Considerations

1. Password field must never be returned in API responses (`json:"-"` tag)
2. Only admins can view all users
3. Users can only update their own profile
4. Status changes are logged in audit logs
5. Phone number changes require verification (future enhancement)

## Dependencies

- Authentication system for JWT validation
- RBAC system for admin permissions
- Audit logging for status changes
