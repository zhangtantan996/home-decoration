# Tinode Clear Chat Capability

## ADDED Requirements

### Requirement: Delete Chat Messages via gRPC

The system SHALL provide an API endpoint to delete all messages in a chat topic using Tinode's gRPC API.

**Properties**:
- **Idempotency**: Calling delete multiple times on the same topic SHALL produce the same result
- **Authorization**: Only the topic participant SHALL be able to delete messages
- **Atomicity**: All messages in the topic SHALL be deleted in a single operation

#### Scenario: User successfully clears chat history

**Given**:
- User is authenticated with valid JWT token
- User has an active chat with topic "usr123_usr456"
- Topic contains 10 messages

**When**:
- User sends DELETE request to `/api/v1/tinode/topic/usr123_usr456/messages`

**Then**:
- Response status is 200 OK
- Response body contains `{"code": 0, "message": "聊天记录已清空"}`
- All 10 messages are deleted from Tinode database
- Operation is logged with user ID and topic name

#### Scenario: User attempts to clear non-existent topic

**Given**:
- User is authenticated with valid JWT token
- Topic "usr123_usr999" does not exist

**When**:
- User sends DELETE request to `/api/v1/tinode/topic/usr123_usr999/messages`

**Then**:
- Response status is 404 Not Found
- Response body contains error message "Topic not found"
- No database changes occur

#### Scenario: Tinode server is unavailable

**Given**:
- User is authenticated with valid JWT token
- Tinode gRPC server is down

**When**:
- User sends DELETE request to `/api/v1/tinode/topic/usr123_usr456/messages`

**Then**:
- Response status is 503 Service Unavailable
- Response body contains error message "Tinode service unavailable"
- Operation is logged with error details
- Client can retry the request

#### Scenario: User attempts to clear another user's chat

**Given**:
- User A is authenticated with valid JWT token
- Topic "usr456_usr789" exists but User A is not a participant

**When**:
- User A sends DELETE request to `/api/v1/tinode/topic/usr456_usr789/messages`

**Then**:
- Response status is 403 Forbidden
- Response body contains error message "Not authorized to delete this topic"
- No messages are deleted

### Requirement: gRPC Connection Management

The system SHALL maintain a persistent gRPC connection to Tinode server with automatic reconnection.

**Properties**:
- **Connection Pooling**: Maximum 10 concurrent gRPC connections
- **Circuit Breaker**: Fail fast after 3 consecutive connection failures
- **Retry Strategy**: Exponential backoff (1s, 2s, 4s, 8s)

#### Scenario: gRPC connection established on startup

**Given**:
- Backend server is starting up
- Tinode gRPC server is running on localhost:16060

**When**:
- Backend initializes gRPC client

**Then**:
- gRPC connection is established successfully
- Connection health check passes
- Backend logs "Tinode gRPC client initialized"

#### Scenario: gRPC connection fails and retries

**Given**:
- gRPC connection is established
- Tinode server crashes

**When**:
- Backend attempts to send delete request

**Then**:
- First attempt fails immediately
- Backend retries after 1 second
- Backend retries after 2 seconds
- Backend retries after 4 seconds
- After 3 failures, circuit breaker opens
- Subsequent requests fail fast with 503 error

### Requirement: Audit Logging

The system SHALL log all chat deletion operations for audit purposes.

**Properties**:
- **Completeness**: All deletion attempts (success and failure) SHALL be logged
- **Immutability**: Audit logs SHALL NOT be modifiable
- **Retention**: Audit logs SHALL be retained for 90 days

#### Scenario: Successful deletion is logged

**Given**:
- User successfully deletes chat history

**When**:
- Deletion operation completes

**Then**:
- Audit log entry is created with:
  - Timestamp
  - User ID
  - Topic name
  - Operation result (success)
  - Number of messages deleted

#### Scenario: Failed deletion is logged

**Given**:
- User attempts to delete chat but Tinode server is unavailable

**When**:
- Deletion operation fails

**Then**:
- Audit log entry is created with:
  - Timestamp
  - User ID
  - Topic name
  - Operation result (failure)
  - Error message
