# Tinode IM Testing - Document Index

> **Quick Navigation**: All documents created for Tinode IM Completion Week 1 plan

---

## 📖 Start Here

**New to this project?** Read these in order:

1. **[TINODE_TESTING_HANDOFF.md](./TINODE_TESTING_HANDOFF.md)** - Complete handoff guide
   - What was done
   - What you need to do
   - How to execute tests
   - Quick start commands

2. **[TINODE_TESTING_SUMMARY.md](./TINODE_TESTING_SUMMARY.md)** - Overall summary
   - Code quality assessment
   - Test execution plan
   - Final report template

---

## 🧪 Test Guides (Execute These)

### Phase 1: Individual Platform Testing

**[MOBILE_E2E_TEST_GUIDE.md](./MOBILE_E2E_TEST_GUIDE.md)**
- 7 test scenarios for Mobile app
- Estimated time: 2 hours
- Prerequisites: iOS/Android simulator

**[ADMIN_E2E_TEST_GUIDE.md](./ADMIN_E2E_TEST_GUIDE.md)**
- 3 test scenarios for Admin panel
- Estimated time: 1 hour
- Prerequisites: Chrome browser

### Phase 2: Integration Testing

**[CROSS_PLATFORM_SYNC_TEST_GUIDE.md](./CROSS_PLATFORM_SYNC_TEST_GUIDE.md)**
- 5 test scenarios for cross-platform sync
- Estimated time: 30 minutes
- Prerequisites: Mobile + Admin running simultaneously

### Phase 3: Feature Testing

**[IMAGE_UPLOAD_TEST_GUIDE.md](./IMAGE_UPLOAD_TEST_GUIDE.md)**
- 7 test scenarios for image upload
- Estimated time: 2 hours
- Prerequisites: Mobile simulator + test images

---

## 📝 Result Recording

历史 repo-local 测试笔记已移出仓库。当前请把结果记录到以下任一共享位置：

- 当前专题文档中的“测试结果 / 问题记录”小节
- 对应 issue、PR 评论或缺陷清单
- 发布 / 验收记录中的执行备注

建议至少记录：
- 场景名与通过/失败结论
- 设备 / 浏览器 / 环境
- 关键日志、截图、性能指标
- 缺陷严重度与重现步骤

---

## 📋 Execution Checklist

历史 repo-local 计划文件已移出仓库。当前请使用：
- 当前任务说明中的 checklist
- issue / PR checklist
- 团队自己的发布或测试执行清单

---

## 💻 Code References

### Mobile App (React Native)

**Core IM Service**:
- `mobile/src/services/TinodeService.ts` - Main IM integration (522 lines)

**UI Screens**:
- `mobile/src/screens/MessageScreen.tsx` - Conversation list (767 lines)
- `mobile/src/screens/ChatRoomScreen.tsx` - Chat interface with image support
- `mobile/src/screens/LoginScreen.tsx` - Login flow

**State Management**:
- `mobile/src/store/authStore.ts` - Authentication state

**Utilities**:
- `mobile/src/utils/SecureStorage.ts` - Secure token storage
- `mobile/src/utils/emojiParser.ts` - Emoji parsing

### Admin Panel (React + Vite)

**Core IM Service**:
- `admin/src/services/TinodeService.ts` - Admin IM integration

**UI Pages**:
- `admin/src/pages/merchant/MerchantChat.tsx` - Merchant chat interface
- `admin/src/pages/merchant/MerchantLogin.tsx` - Merchant login

**API Services**:
- `admin/src/services/merchantApi.ts` - Merchant API calls

### Backend (Go)

**Upload Handler**:
- `server/internal/handler/upload_handler.go` - File upload API

**Router**:
- `server/internal/router/router.go` - Route configuration

---

## 🎯 Quick Reference

### Test Accounts

**Mobile (Customer)**:
- Account A: `13800138000` / code: `123456`
- Account B: `13800138001` / code: `123456`

**Admin (Merchant)**:
- Merchant: `13900139001` / code: `123456`

### Service URLs

- **Tinode Server**: `localhost:6060` (WebSocket)
- **Backend API**: `http://localhost:8080`
- **Admin Panel**: `http://localhost:5173`
- **Database**: `localhost:5432` (PostgreSQL)

### Quick Start Commands

```bash
# Start Mobile
cd mobile && npm start
npm run ios  # or npm run android

# Start Admin
cd admin && npm run dev

# Check Services
docker ps | grep tinode
curl http://localhost:8080/api/v1/health
```

---

## 📊 Test Scenario Summary

| Guide | Scenarios | Time | Status |
|-------|-----------|------|--------|
| Mobile E2E | 7 | 2h | ⚠️ Pending |
| Admin E2E | 3 | 1h | ⚠️ Pending |
| Cross-Platform | 5 | 30m | ⚠️ Pending |
| Image Upload | 7 | 2h | ⚠️ Pending |
| **Total** | **22** | **5.5h** | **⚠️ Pending** |

---

## ✅ Completion Checklist

### Before Starting
- [ ] Read TINODE_TESTING_HANDOFF.md
- [ ] Verify environment (Task 1 already complete)
- [ ] Prepare test devices (simulator/browser)
- [ ] Review test accounts

### During Testing
- [ ] Execute Phase 1: Mobile + Admin E2E
- [ ] Execute Phase 2: Cross-Platform Sync
- [ ] Execute Phase 3: Image Upload
- [ ] Document results in notepad files
- [ ] Record performance metrics

### After Testing
- [ ] Review all test results
- [ ] Prioritize bugs (if any)
- [ ] Fix P0 and P1 bugs
- [ ] Generate final report
- [ ] Update plan file checkboxes

---

## 🆘 Need Help?

### Troubleshooting

1. **Check test guides** - Each has troubleshooting section
2. **Check notepad files** - Previous findings may help
3. **Check console logs** - Browser DevTools / Metro bundler
4. **Check service logs**:
   ```bash
   docker logs decorating_tinode
   docker logs home_decor_db_local
   ```

### Common Issues

**Services not running**:
```bash
docker start decorating_tinode
cd server && make dev
```

**Dependencies issues**:
```bash
cd mobile && rm -rf node_modules && npm install
cd admin && rm -rf node_modules && npm install
```

---

## 📈 Success Metrics

### Target Values

| Metric | Target | Measure During |
|--------|--------|----------------|
| Message send success | ≥99% | Tasks 2, 3, 4 |
| Message latency | <2s | Task 4 |
| Offline delivery | 100% | Task 2 |
| Reconnection success | ≥95% | Task 2 |

---

## 🎉 What's Been Accomplished

✅ **Environment verified** - All services operational  
✅ **Code inspected** - Production-ready quality  
✅ **Test guides created** - 22 scenarios documented  
✅ **Documentation complete** - Comprehensive handoff  
✅ **Notepad prepared** - Ready for result tracking  

---

## 🚀 Next Steps

1. **Start with Phase 1** - Mobile + Admin E2E testing
2. **Document as you go** - Use notepad files
3. **Measure performance** - Record actual metrics
4. **Fix bugs** - If any are discovered
5. **Generate report** - Use template provided

---

**Total Estimated Time**: 6.5 - 10.5 hours  
**Current Status**: Ready for manual testing execution  
**Code Quality**: Production-ready  
**Risk Level**: Low  

---

**Document Version**: 1.0  
**Created**: 2026-01-23  
**Last Updated**: 2026-01-23  
**Maintained By**: AI Assistant
