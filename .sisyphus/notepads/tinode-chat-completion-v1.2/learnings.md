# Learnings - Tinode Chat Completion v1.2

## [2026-01-23T21:47:22Z] Session Start: ses_4132c80dcffe33POC5yYVbCPyH

### Plan Overview
- **Total Tasks**: 44 (across 5 phases)
- **Phase 0**: 3 tasks (code cleanup) - 1 day, parallelizable
- **Phase 1**: 4 tasks (fix known issues) - 1-2 days, partially parallelizable
- **Phase 2-5**: Deferred for now

### Key Architectural Decisions
- Primary IM: Tinode (Mobile + Admin integrated)
- Backup: Tencent Cloud IM (preserved but not maintained)
- Deprecated: Self-built WebSocket (to be deleted)
- Database: Remove Conversation/ChatMessage tables (Tinode doesn't use them)

### Critical Constraints from AGENTS.md
- Admin React must remain `react@18.3.1` and `react-dom@18.3.1` EXACT
- Mobile uses React `19.2.0` - do NOT unify versions
- Admin UI kit: Ant Design 5.x only
- Frontend state: Zustand only
- Backend layering: handler -> service -> repository (strict)
- Go version: 1.21

---

## [2026-01-25T09:17:35Z] Session Resume: ses_40f1a7851ffeWBk7M5QAGkW9V6

### New Comprehensive Review Completed
- Conducted full 3-dimensional review (Mobile + Admin + Server)
- **Mobile**: 55% complete (core features done, advanced features missing)
- **Admin**: 38% complete (missing image/file sending - P0 issue)
- **Server**: 70% complete (infrastructure done, advanced features missing)

### Critical Security Issues Discovered (P0 - Must Fix Immediately)
1. **Server hardcoded keys** in `server/config/tinode.conf` line 16 (Auth Token Key)
2. **Server hardcoded keys** in `docker-compose.tinode.yml` line 12 (UID encryption key)
3. **Server hardcoded password** in `server/config/tinode.conf` line 10 (database password)
4. **Mobile hardcoded API Key** in `mobile/src/config/tinode.ts` line 11

### User Decision
- User confirmed: Phase 0 and Phase 1 are complete
- User requested: Start with security fixes (Phase 1.1 in new plan)
- User wants: Step-by-step execution with document updates

### New Priority Order (Based on Review)
**P0 - Security Fixes** (1 day):
1. Remove Server hardcoded keys
2. Remove Mobile hardcoded API Key
3. Configure environment variables

**P0 - Admin Feature Parity** (3-4 days):
4. Admin image upload/send
5. Admin file attachment send
6. Admin image preview modal optimization

**P0 - Mobile Message Resend** (1 day):
7. Implement message resend mechanism

---

## Security Fix: Removed Hardcoded Secrets (2026-01-25)

### Problem
Critical P0 security issue: Multiple hardcoded secrets found in Tinode configuration files:
1. `server/config/tinode.conf` line 16: Auth Token Key hardcoded
2. `server/config/tinode.conf` line 10: Database password in plaintext
3. `docker-compose.tinode.yml` line 11-15: All secrets hardcoded (UID encryption key, API key salt, Auth token key, database DSN)

### Solution
Replaced all hardcoded secrets with environment variables:

**Files Modified:**
1. `server/config/tinode.conf`:
   - Changed `"key": "wfaY2RgF2S1OQI/ZlK+LSrp1KB2jwAdGAIHQ7JZn+Kc="` → `"key": "${TINODE_AUTH_TOKEN_KEY}"`
   - Changed `"dsn": "postgres://postgres:123456@..."` → `"dsn": "${TINODE_DATABASE_DSN}"`

2. `docker-compose.tinode.yml`:
   - Changed `POSTGRES_DSN=postgres://postgres:IXwUBjxFia33XltiY0wFch8n3N68hptI@...` → `POSTGRES_DSN=${TINODE_DATABASE_DSN}`
   - Changed `UID_ENCRYPTION_KEY=la6YsO+bNX/+XIkOqc5Svw==` → `UID_ENCRYPTION_KEY=${TINODE_UID_ENCRYPTION_KEY}`
   - Changed `API_KEY_SALT=T713/rYYgW7g4m3vG6zGRh7+FM1t0T8j13koXScOAj4=` → `API_KEY_SALT=${TINODE_API_KEY_SALT}`
   - Changed `AUTH_TOKEN_KEY=jPsAHbLFCuvAkJtL9lsP/nYJLi0X3eIUhDN+uQ29NUI=` → `AUTH_TOKEN_KEY=${TINODE_AUTH_TOKEN_KEY}`

3. `.env.example`:
   - Added comprehensive Tinode environment variables section with:
     - `TINODE_DATABASE_DSN`: Database connection string
     - `TINODE_UID_ENCRYPTION_KEY`: 16-byte Base64 key for UID encryption
     - `TINODE_AUTH_TOKEN_KEY`: 32-byte Base64 key for auth tokens
     - `TINODE_API_KEY_SALT`: 32-byte Base64 salt for API keys
   - Included generation instructions: `openssl rand -base64 16` and `openssl rand -base64 32`

### Key Generation Commands
```bash
# UID Encryption Key (16 bytes)
openssl rand -base64 16

# Auth Token Key (32 bytes)
openssl rand -base64 32

# API Key Salt (32 bytes)
openssl rand -base64 32
```

### Verification
- Server builds successfully: `cd server && make build` ✓
- No hardcoded secrets remain in configuration files ✓
- All secrets now use environment variable substitution ✓

### Next Steps for Deployment
1. Generate new secure keys using the commands above
2. Create `.env` file from `.env.example`
3. Fill in all `TINODE_*` environment variables with generated keys
4. Never commit `.env` file to Git (already in `.gitignore`)

### Security Impact
- **Before**: All secrets exposed in Git history (CRITICAL vulnerability)
- **After**: Secrets externalized to environment variables (SECURE)
- **Action Required**: Rotate all exposed keys in production immediately

## [2026-01-25T09:30:00Z] Security Fix Completed

### Task: Remove Server Hardcoded Keys (P0)
**Status**: ✅ COMPLETED
**Duration**: ~15 minutes
**Session**: ses_40efafabaffeN5DPDEQKmlgeTj

### Changes Made:
1. **server/config/tinode.conf**:
   - Line 16: Auth Token Key → `${TINODE_AUTH_TOKEN_KEY}`
   - Line 10: Database DSN → `${TINODE_DATABASE_DSN}`

2. **docker-compose.tinode.yml**:
   - Line 12: UID Encryption Key → `${TINODE_UID_ENCRYPTION_KEY}`
   - Line 13: API Key Salt → `${TINODE_API_KEY_SALT}`
   - Line 15: Auth Token Key → `${TINODE_AUTH_TOKEN_KEY}`
   - Line 11: Database DSN → `${TINODE_DATABASE_DSN}`

3. **.env.example**:
   - Added TINODE_DATABASE_DSN with template
   - Added TINODE_UID_ENCRYPTION_KEY with generation instructions
   - Added TINODE_AUTH_TOKEN_KEY with generation instructions
   - Added TINODE_API_KEY_SALT with generation instructions

### Verification:
- ✅ `make build` passed
- ✅ No hardcoded secrets remain
- ✅ All environment variables documented

### Next Steps:
- User needs to generate actual keys using:
  ```bash
  openssl rand -base64 16  # For TINODE_UID_ENCRYPTION_KEY
  openssl rand -base64 32  # For TINODE_AUTH_TOKEN_KEY and TINODE_API_KEY_SALT
  ```
- Create `.env` file from `.env.example` and fill in the values
- Rotate exposed secrets in production immediately

---
