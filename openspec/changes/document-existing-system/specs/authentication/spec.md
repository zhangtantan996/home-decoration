# Authentication System Specification

## Overview
The home decoration platform uses a multi-channel authentication system supporting JWT tokens, WeChat Mini Program login, and phone-based authentication.

## ADDED Requirements

### Requirement: JWT Token Authentication
The system SHALL use JWT (JSON Web Token) for stateless authentication across all API endpoints.

#### Scenario: User logs in with phone and password
- GIVEN a registered user with phone "13800138000" and password
- WHEN the user submits login credentials to `/api/v1/auth/login`
- THEN the system returns a JWT token and refresh token
- AND the token contains user ID, user type, and expiration time
- AND the token is valid for 24 hours
- AND the refresh token is valid for 7 days

#### Scenario: User accesses protected endpoint with valid token
- GIVEN a user with a valid JWT token
- WHEN the user makes a request to a protected endpoint with `Authorization: Bearer <token>` header
- THEN the system validates the token
- AND extracts the user ID from the token
- AND allows access to the endpoint

#### Scenario: User accesses protected endpoint with expired token
- GIVEN a user with an expired JWT token
- WHEN the user makes a request to a protected endpoint
- THEN the system returns 401 Unauthorized
- AND the response includes an error message "token expired"

### Requirement: Token Refresh Mechanism
Users SHALL be able to refresh their access token using a refresh token without re-authenticating.

#### Scenario: User refreshes access token
- GIVEN a user with a valid refresh token
- WHEN the user submits the refresh token to `/api/v1/auth/refresh`
- THEN the system validates the refresh token
- AND issues a new access token
- AND returns the new token to the user

#### Scenario: User attempts to refresh with invalid refresh token
- GIVEN a user with an invalid or expired refresh token
- WHEN the user submits the refresh token
- THEN the system returns 401 Unauthorized
- AND requires the user to log in again

### Requirement: WeChat Mini Program Authentication
Users SHALL be able to authenticate using WeChat Mini Program login flow.

#### Scenario: User logs in via WeChat Mini Program
- GIVEN a user opens the WeChat Mini Program
- WHEN the user triggers WeChat login
- THEN the mini program calls `wx.login()` to get a code
- AND sends the code to `/api/v1/auth/wechat/mini/login`
- AND the backend exchanges the code for openid and session_key with WeChat API
- AND the system creates or finds the user by openid
- AND returns JWT token and refresh token

#### Scenario: User binds phone number in WeChat Mini Program
- GIVEN a user logged in via WeChat with openid
- WHEN the user triggers phone number binding
- THEN the mini program calls `wx.getPhoneNumber()` to get encrypted phone data
- AND sends the encrypted data to `/api/v1/auth/wechat/mini/bind-phone`
- AND the backend decrypts the phone number using session_key
- AND binds the phone number to the user account
- AND updates the UserWechatBinding record

### Requirement: Admin Authentication
Admin users SHALL have separate authentication with additional security measures.

#### Scenario: Admin logs in
- GIVEN an admin user with username and password
- WHEN the admin submits credentials to `/api/v1/admin/auth/login`
- THEN the system validates the credentials
- AND checks if the account is locked (after 5 failed attempts)
- AND returns an admin JWT token with admin permissions
- AND records the login in audit logs

#### Scenario: Admin account locked after failed attempts
- GIVEN an admin user with 4 previous failed login attempts
- WHEN the admin fails to log in again (5th attempt)
- THEN the system locks the account for 30 minutes
- AND sets `LockedUntil` timestamp
- AND returns error "account locked, try again after 30 minutes"

### Requirement: Account Security
The system SHALL implement security measures to prevent brute force attacks and unauthorized access.

#### Scenario: Rate limiting on login endpoint
- GIVEN the login endpoint `/api/v1/auth/login`
- WHEN a user makes more than 5 login attempts within 1 minute
- THEN the system blocks further attempts
- AND returns 429 Too Many Requests

#### Scenario: Password hashing
- GIVEN a user registers with password "MyPassword123"
- WHEN the system stores the password
- THEN the password is hashed using bcrypt with cost factor 10
- AND the plain text password is never stored
- AND the password field has `json:"-"` tag to prevent exposure in API responses

## Data Models

### User
```go
type User struct {
    Base
    Phone             string     `json:"phone" gorm:"uniqueIndex;size:20"`
    Nickname          string     `json:"nickname" gorm:"size:50"`
    Avatar            string     `json:"avatar" gorm:"size:500"`
    Password          string     `json:"-" gorm:"size:255"` // Never returned to frontend
    UserType          int8       `json:"userType"`          // 1:homeowner 2:provider 3:worker 4:admin
    Status            int8       `json:"status" gorm:"default:1"`
    LoginFailedCount  int        `json:"-" gorm:"default:0"`
    LockedUntil       *time.Time `json:"-"`
    LastFailedLoginAt *time.Time `json:"-"`
}
```

### UserWechatBinding
```go
type UserWechatBinding struct {
    Base
    UserID      uint64     `json:"userId" gorm:"index"`
    AppID       string     `json:"appId" gorm:"size:64"`
    OpenID      string     `json:"openId" gorm:"size:128"`
    UnionID     string     `json:"unionId" gorm:"size:128"`
    BoundAt     *time.Time `json:"boundAt"`
    LastLoginAt *time.Time `json:"lastLoginAt"`
}
```

## API Endpoints

### POST /api/v1/auth/login
- **Description**: User login with phone and password
- **Request Body**: `{ "phone": "13800138000", "password": "password123" }`
- **Response**: `{ "token": "jwt_token", "refreshToken": "refresh_token", "user": {...} }`
- **Middleware**: LoginRateLimit (5 requests/minute)

### POST /api/v1/auth/refresh
- **Description**: Refresh access token
- **Request Body**: `{ "refreshToken": "refresh_token" }`
- **Response**: `{ "token": "new_jwt_token" }`

### POST /api/v1/auth/wechat/mini/login
- **Description**: WeChat Mini Program login
- **Request Body**: `{ "code": "wechat_code" }`
- **Response**: `{ "token": "jwt_token", "refreshToken": "refresh_token", "openid": "..." }`

### POST /api/v1/auth/wechat/mini/bind-phone
- **Description**: Bind phone number in WeChat Mini Program
- **Request Body**: `{ "encryptedData": "...", "iv": "..." }`
- **Response**: `{ "phone": "13800138000" }`
- **Middleware**: JWT (requires authenticated user)

### POST /api/v1/admin/auth/login
- **Description**: Admin login
- **Request Body**: `{ "username": "admin", "password": "admin123" }`
- **Response**: `{ "token": "admin_jwt_token", "admin": {...} }`

## Security Considerations

1. **JWT Secret**: Must be stored in environment variable `JWT_SECRET`, never hardcoded
2. **WeChat Credentials**: `WECHAT_MINI_APPID` and `WECHAT_MINI_SECRET` must be in environment
3. **Password Storage**: Always use bcrypt with cost factor ≥ 10
4. **Token Expiration**: Access token 24h, refresh token 7 days
5. **Rate Limiting**: 5 login attempts per minute per IP
6. **Account Locking**: 5 failed attempts → 30 minutes lockout
7. **CORS**: Strict whitelist of allowed origins

## Middleware

### JWT Middleware
- **Path**: `internal/middleware/jwt.go`
- **Purpose**: Validates JWT token and injects user ID into context
- **Usage**: Applied to all protected routes under `/api/v1/*`

### AdminJWT Middleware
- **Path**: `internal/middleware/admin_jwt.go`
- **Purpose**: Validates admin JWT token
- **Usage**: Applied to admin routes under `/api/v1/admin/*`

### LoginRateLimit Middleware
- **Purpose**: Prevents brute force attacks
- **Configuration**: 5 requests per minute
- **Usage**: Applied to login endpoints

## Dependencies

- **External Services**: WeChat API for Mini Program authentication
- **Libraries**:
  - `github.com/golang-jwt/jwt/v5` for JWT
  - `golang.org/x/crypto/bcrypt` for password hashing
- **Database**: PostgreSQL for user and binding storage
- **Cache**: Redis for rate limiting

## Testing Scenarios

1. Successful login with valid credentials
2. Failed login with invalid credentials
3. Account lockout after 5 failed attempts
4. Token refresh with valid refresh token
5. WeChat login flow end-to-end
6. Phone binding in WeChat Mini Program
7. Rate limiting enforcement
8. Token expiration handling
9. Admin login with RBAC permissions
10. Cross-origin request handling (CORS)
