# Decisions - Tinode Chat Completion v1.2

## [2026-01-23T21:47:22Z] Initial Decisions

### Architecture Decisions (from plan)
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chat Architecture | ✅ Tinode primary | Mobile + Admin already integrated |
| Backup Solution | ✅ Tencent IM preserved | Emergency fallback, not maintained |
| Self-built WebSocket | ❌ Delete completely | Deprecated, increases maintenance cost |
| Offline Messages | ✅ Tinode native | Auto-store + push, no extra dev needed |
| Voice Messages | ✅ Tinode Drafty AU | Native support, UI implementation only |
| Push Notifications | ⏸️ Defer to Phase 5 | Use JPush later |
| Mini Program | ⏸️ Defer | Focus on Mobile + Admin first |
| Database Tables | ❌ Delete Conversation/ChatMessage | Tinode doesn't use them |

### Execution Strategy
- **Phase 0**: All 3 tasks can run in parallel (independent file changes)
- **Phase 1**: Tasks 1.1, 1.2, 1.3 can run in parallel; Task 1.4 depends on 1.3 completion
- **Verification**: Project-level LSP diagnostics + build + tests after EVERY delegation

---
