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
