# Issues - Tinode Chat Completion v1.2

## [2026-01-23T21:47:22Z] Known Issues from Plan

### Phase 1 Issues to Fix
1. **Admin Image Rendering**: Shows "【图片】" text instead of actual images
2. **Mobile File Attachments**: All DocumentPicker files sent as images (incorrect)
3. **Image Preview**: No modal preview functionality
4. **More Menu**: "View Profile" and "Clear Chat" not implemented

### Potential Gotchas
- Admin package.json currently uses `^` for React versions (treat as bug per TROUBLESHOOTING.md)
- Mobile uses different React version (19.2.0) - do NOT unify
- Tinode Drafty format: IM (images), EX (files), AU (audio)
- AsyncStorage needed for persistent clear chat functionality

---
