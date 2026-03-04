# Wave 3 Learnings

## MerchantApplyStatus.tsx 全面修复 (Task 9)

### 实现内容
1. **useEffect 依赖修复**: 将 `handleQuery` 包装在 `useCallback` 中，消除 exhaustive-deps 警告
2. **并行查询策略**: 用 `Promise.allSettled` 替换顺序 try/catch，同时查询 merchant 和 material-shop API
3. **待审核状态轮询**: 当 status === 0 时启动 30 秒轮询，组件卸载时通过 `clearInterval` 清理
4. **applicantType 回退映射**: 为 studio/personal 等未知类型添加回退逻辑，映射到 designer
5. **主题常量应用**: 将页面背景从硬编码 `#f0f2f5` 替换为 `MERCHANT_THEME.pageBgGradient`

### 验证结果
- LSP diagnostics: 无错误
- Promise.allSettled: ✓ (line 30)
- clearInterval: ✓ (line 72)
- applicantType fallback: ✓ (lines 183-187)
- MERCHANT_THEME usage: ✓ (line 213)

### 技术决策
- 轮询间隔设为 30 秒，平衡用户体验与服务器负载
- 使用 `useRef<number | null>` 存储 timer ID，确保清理时类型安全
- applicantType 回退链: foreman → company → studio → personal → designer (默认)
