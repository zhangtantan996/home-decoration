# Escrow Payment System Specification

## Overview
Escrow payment system manages secure fund transfers between homeowners and providers with milestone-based releases.

## ADDED Requirements

### Requirement: Escrow Account Creation
Each project SHALL have a dedicated escrow account to hold funds.

#### Scenario: Create escrow account for project
- GIVEN a new project is created
- WHEN the system initializes the project
- THEN an EscrowAccount is created automatically
- AND linked to the project and homeowner
- AND initialized with zero balances

### Requirement: Deposit Funds
Homeowners SHALL be able to deposit funds into escrow account.

#### Scenario: Deposit funds to escrow
- GIVEN a homeowner with a project
- WHEN the homeowner deposits 100,000 CNY
- THEN the system uses database transaction with row-level locking
- AND increases `totalAmount` by 100,000
- AND increases `frozenAmount` by 100,000
- AND creates a Transaction record with type="deposit"
- AND commits the transaction atomically

### Requirement: Release Payment on Milestone
Funds SHALL be released to provider when milestone is accepted.

#### Scenario: Release milestone payment
- GIVEN a milestone with amount=20,000 CNY is accepted
- WHEN the system processes the acceptance
- THEN it uses database transaction with pessimistic locking
- AND decreases `frozenAmount` by 20,000
- AND increases `releasedAmount` by 20,000
- AND creates Transaction record with type="release"
- AND transfers funds to provider's account
- AND commits atomically

### Requirement: Refund on Cancellation
Funds SHALL be refunded to homeowner if project is cancelled.

#### Scenario: Refund escrow on project cancellation
- GIVEN a project with 50,000 CNY in frozen amount
- WHEN the project is cancelled
- THEN the system refunds the frozen amount to homeowner
- AND decreases `frozenAmount` to 0
- AND creates Transaction record with type="refund"
- AND updates escrow status to "settled"

### Requirement: Transaction Integrity
All escrow operations MUST be atomic and prevent race conditions.

#### Scenario: Concurrent withdrawal attempts
- GIVEN an escrow account with 10,000 CNY frozen
- WHEN two milestone releases of 8,000 CNY each are attempted simultaneously
- THEN the system uses pessimistic locking (`SELECT FOR UPDATE`)
- AND only one transaction succeeds
- AND the other fails with "insufficient balance" error

## Data Models

### EscrowAccount
- **ID**: uint64
- **ProjectID**: uint64 (unique, indexed)
- **UserID**: uint64 (account owner - homeowner)
- **ProjectName**: string
- **UserName**: string
- **TotalAmount**: float64 (total deposited)
- **FrozenAmount**: float64 (locked for milestones)
- **AvailableAmount**: float64 (available for withdrawal)
- **ReleasedAmount**: float64 (released to provider)
- **Status**: int8 (0:inactive, 1:active, 2:frozen, 3:settled)

### Transaction
- **ID**: uint64
- **EscrowAccountID**: uint64
- **OrderID**: uint64 (optional)
- **Type**: string (deposit, release, refund, freeze, unfreeze)
- **Amount**: float64
- **Status**: int8 (0:pending, 1:success, 2:failed)
- **Description**: string
- **CreatedAt**: timestamp

## API Endpoints

### POST /api/v1/escrow/deposit
- **Description**: Deposit funds to escrow
- **Middleware**: JWT (homeowner), RateLimit(10/min)
- **Request Body**: `{ "projectId": 123, "amount": 100000 }`
- **Response**: Updated escrow account

### POST /api/v1/escrow/release
- **Description**: Release milestone payment
- **Middleware**: JWT (system/admin)
- **Request Body**: `{ "milestoneId": 456, "amount": 20000 }`
- **Response**: Transaction record

### GET /api/v1/escrow/accounts/:projectId
- **Description**: Get escrow account details
- **Middleware**: JWT (project owner or provider)
- **Response**: Escrow account with transaction history

### GET /api/v1/escrow/transactions
- **Description**: List transactions
- **Middleware**: JWT
- **Query Params**: projectId, type, status
- **Response**: Paginated transaction list

### POST /api/v1/admin/escrow/refund
- **Description**: Admin refund (admin only)
- **Middleware**: AdminJWT, RequirePermission("escrow:refund")
- **Request Body**: `{ "escrowAccountId": 789, "amount": 50000, "reason": "..." }`
- **Response**: Refund transaction

## Business Rules

1. **Atomic Operations**: All escrow operations must use database transactions
2. **Pessimistic Locking**: Use `SELECT FOR UPDATE` for balance checks
3. **Double-Entry Bookkeeping**: Every transaction creates a Transaction record
4. **Balance Invariant**: `totalAmount = frozenAmount + availableAmount + releasedAmount`
5. **Sequential Milestones**: Payments released in milestone sequence order
6. **Audit Trail**: All operations logged in AuditLog table
7. **Idempotency**: Prevent duplicate transactions using order IDs

## Security Considerations

1. **Race Conditions**: Prevented by pessimistic locking
2. **SQL Injection**: Use parameterized queries only
3. **Authorization**: Only project owner can deposit, only system can release
4. **Rate Limiting**: 10 deposit requests per minute
5. **Audit Logging**: All financial operations logged with operator info
6. **Encryption**: Sensitive data encrypted at rest
7. **No Floating Point**: Use int64 cents or decimal for money (future enhancement)

## Critical Code Patterns

### Correct Transaction Pattern
```go
tx := db.Begin()
defer tx.Rollback()

// Lock account row
var account EscrowAccount
if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
    Where("project_id = ?", projectID).
    First(&account).Error; err != nil {
    return err
}

// Check balance
if account.FrozenAmount < amount {
    return errors.New("insufficient balance")
}

// Update balance
account.FrozenAmount -= amount
account.ReleasedAmount += amount
if err := tx.Save(&account).Error; err != nil {
    return err
}

// Record transaction
transaction := &Transaction{
    EscrowAccountID: account.ID,
    Type:            "release",
    Amount:          amount,
    Status:          1,
}
if err := tx.Create(transaction).Error; err != nil {
    return err
}

return tx.Commit().Error
```

## Dependencies

- Project management for milestone triggers
- User management for account ownership
- Audit logging for compliance
- Payment gateway integration (future)
- Notification system for transaction alerts

## Testing Scenarios

1. Deposit funds successfully
2. Release milestone payment
3. Refund on project cancellation
4. Concurrent withdrawal prevention (race condition test)
5. Insufficient balance error
6. Transaction rollback on failure
7. Balance invariant verification
8. Audit log creation
9. Rate limiting enforcement
10. Authorization checks (owner vs provider)
