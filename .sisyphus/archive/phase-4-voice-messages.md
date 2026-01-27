# Phase 4: 语音消息功能实现计划

**版本**: 1.0  
**日期**: 2026-01-25  
**规划者**: Prometheus  
**审查者**: Metis (已完成)

---

## Context

### Original Request
继续 tinode-chat-completion-v1.2 计划中的 Phase 4 - 语音消息功能。

### Interview Summary
**Key Discussions**:
- 用户有 React Native 原生开发环境 ✅
- 用户有 Android 设备用于测试 ✅
- 用户没有 iOS 设备（仅 Android 测试）
- 录音交互：按住录音（类似微信）
- Drafty 实体类型：使用 `tp: 'EX'`（更安全）
- 消息预览：显示时长「【语音 12s】」
- Admin 播放器：自定义 UI（Ant Design 风格）

**Research Findings**:
- `react-native-audio-recorder-player` 已废弃
- 官方替代：`react-native-nitro-sound`（相同 API，更好性能）
- 后端上传白名单需要添加音频格式（当前会拒绝 .m4a 文件）
- 现有 `TinodeService.sendFileMessage()` 可作为参考模式

### Metis Review
**Identified Gaps** (addressed):
- 后端音频格式白名单：添加为 Task 0（阻塞任务）
- Drafty 实体类型：确认使用 `tp: 'EX'`
- iOS 测试：标记为"未测试"，但仍实现兼容代码
- 权限处理：遵循现有 camera 权限模式

---

## Work Objectives

### Core Objective
实现语音消息功能：Mobile 端录制和播放，Admin 端播放。

### Concrete Deliverables
- Mobile: 按住录音组件 + 语音播放器组件
- Admin: 语音播放器组件（Ant Design 风格）
- Server: 音频格式上传支持
- TinodeService: `sendAudioMessage()` 方法

### Definition of Done
- [x] Mobile 能录制语音消息（≤60秒，≤5MB）
- [x] Mobile 能发送语音消息到 Tinode
- [x] Mobile 能播放收到的语音消息
- [x] Admin 能播放收到的语音消息
- [x] 消息列表显示「【语音 12s】」预览
- [x] 所有构建通过（`npm run build`, `make build`）

### Must Have
- 按住录音交互（按住开始，松开发送，上滑取消）
- 录音时长限制（60秒）
- 文件大小限制（5MB）
- 播放/暂停控制
- 进度条显示
- 时长显示
- 失败重试机制

### Must NOT Have (Guardrails)
- ❌ 波形可视化（用户明确排除）
- ❌ Admin 录音功能（用户明确排除）
- ❌ 自动播放（用户明确排除）
- ❌ 播放速度控制（不在需求中）
- ❌ 后台录音（超出范围）
- ❌ 语音转文字（超出范围）

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO（需要安装 react-native-nitro-sound）
- **User wants tests**: Manual-only（Android 设备手动测试）
- **Framework**: None（手动 QA）

### Manual QA Procedures

每个任务包含详细的手动验证步骤：
- Mobile: 使用 Android 设备测试
- Admin: 使用浏览器测试
- Server: 使用 curl 测试

---

## Task Flow

```
Task 0 (Backend) ──┬──> Task 1 (Install) ──> Task 2 (Recording) ──> Task 3 (Sending)
                   │                                                      │
                   │                                                      v
                   └──────────────────────────────────────────────> Task 4 (Mobile Playback)
                                                                          │
                                                                          v
                                                                    Task 5 (Admin Playback)
                                                                          │
                                                                          v
                                                                    Task 6 (Message Preview)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 0 | Backend blocker, must complete first |
| B | 1 | Dependency installation |
| C | 2, 3 | Recording + Sending (sequential) |
| D | 4, 5 | Playback (can parallel after 3) |
| E | 6 | Message preview (after 4) |

| Task | Depends On | Reason |
|------|------------|--------|
| 1 | 0 | Need backend ready for upload testing |
| 2 | 1 | Need audio library installed |
| 3 | 2 | Need recording working to test sending |
| 4 | 3 | Need sent messages to test playback |
| 5 | 3 | Need sent messages to test admin playback |
| 6 | 4 | Need playback working for preview |

---

## TODOs

### Task 0: 后端添加音频格式支持 (BLOCKER)

**What to do**:
- 在 `server/internal/handler/upload_handler.go` 的文件类型白名单中添加音频格式
- 添加扩展名：`.m4a`, `.mp4`, `.aac`, `.mp3`, `.wav`, `.ogg`
- 测试上传端点能接受音频文件

**Must NOT do**:
- 不要修改文件大小限制（保持 50MB）
- 不要修改上传路径格式

**Parallelizable**: NO (blocker for all other tasks)

**References**:

**Pattern References**:
- `server/internal/handler/upload_handler.go:35-40` - 现有文件类型白名单

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 使用 curl 测试上传 .m4a 文件:
  ```bash
  # 注意: API 端点是 /api/v1/upload (不是 /api/v1/upload/chat)
  # /chat 是服务器端存储目录，不是 API 路径
  curl -X POST http://localhost:8080/api/v1/upload \
    -H "Authorization: Bearer <token>" \
    -F "file=@test.m4a"
  ```
- [x] Response status: 200
- [x] Response body contains: `{"url": "/uploads/chat/..."}` 

**Commit**: YES
- Message: `feat(server): add audio file format support for voice messages`
- Files: `server/internal/handler/upload_handler.go`
- Pre-commit: `cd server && make build`

---

### Task 1: 安装 react-native-nitro-sound

**What to do**:
- 安装 `react-native-nitro-sound` 和 `react-native-nitro-modules`
- 在 `AndroidManifest.xml` 添加 `RECORD_AUDIO` 权限
- 更新 iOS `Info.plist` 麦克风权限描述（即使不测试 iOS）
- 重新构建 Android 应用

**Must NOT do**:
- 不要修改 React 版本
- 不要添加其他音频库

**Parallelizable**: NO (depends on Task 0)

**References**:

**Pattern References**:
- `mobile/package.json` - 现有依赖列表
- `mobile/android/app/src/main/AndroidManifest.xml` - Android 权限配置
- `mobile/ios/HomeDecorationApp/Info.plist:40-41` - iOS 麦克风权限描述

**Documentation References**:
- react-native-nitro-sound: https://github.com/hyochan/react-native-nitro-sound

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 安装依赖:
  ```bash
  cd mobile
  npm install react-native-nitro-sound react-native-nitro-modules
  ```
- [x] 清理并重建 Android:
  ```bash
  cd android && ./gradlew clean && cd ..
  npm run android
  ```
- [x] 应用成功启动，无崩溃
- [x] TypeScript 编译通过:
  ```bash
  npx tsc -p tsconfig.json --noEmit
  ```

**Commit**: YES
- Message: `feat(mobile): install react-native-nitro-sound for voice messages`
- Files: `mobile/package.json`, `mobile/package-lock.json`, `mobile/android/app/src/main/AndroidManifest.xml`, `mobile/ios/HomeDecorationApp/Info.plist`
- Pre-commit: `npx tsc -p mobile/tsconfig.json --noEmit`

---

### Task 2: 实现按住录音组件

**What to do**:
- 创建 `VoiceRecorder` 组件，实现按住录音交互
- 按住开始录音，松开发送，上滑取消
- 显示录音时长（实时更新）
- 实现 60 秒时长限制（自动停止）
- 实现 Android 麦克风权限请求
- 添加录音状态指示（录音中/取消中）

**Must NOT do**:
- 不要添加波形可视化
- 不要实现后台录音
- 不要添加录音暂停功能

**Parallelizable**: NO (depends on Task 1)

**References**:

**Pattern References**:
- `mobile/src/screens/ChatRoomScreen.tsx:1039-1118` - 相机权限请求模式
- `mobile/src/screens/ChatRoomScreen.tsx:720-745` - 失败消息重试机制

**API/Type References**:
- react-native-nitro-sound `useSoundRecorder` hook
- `PermissionsAndroid.PERMISSIONS.RECORD_AUDIO`

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 在 Android 设备上测试:
  1. 打开聊天界面
  2. 长按录音按钮
  3. 看到录音状态指示和时长显示
  4. 松开按钮，录音停止
  5. 上滑取消，录音被丢弃
- [x] 权限测试:
  1. 首次录音弹出权限请求对话框
  2. 拒绝权限后显示友好提示
- [x] 时长限制测试:
  1. 录音超过 60 秒自动停止
  2. 显示"录音时长已达上限"提示

**Commit**: YES
- Message: `feat(mobile): implement hold-to-record voice recorder component`
- Files: `mobile/src/components/VoiceRecorder.tsx`, `mobile/src/screens/ChatRoomScreen.tsx`
- Pre-commit: `npx tsc -p mobile/tsconfig.json --noEmit`

---

### Task 3: 实现语音消息发送

**What to do**:
- 在 `TinodeService.ts` 添加 `sendAudioMessage()` 方法
- 使用 Drafty `tp: 'EX'` 实体类型
- 包含 `duration`（毫秒）和 `size`（字节）元数据
- 实现 5MB 文件大小限制
- 添加失败重试机制（`retry: { kind: 'audio', file: {...} }`）
- 集成 `VoiceRecorder` 到 `ChatRoomScreen`

**音频格式说明**:
- Android 录音默认格式: `.m4a` (MPEG-4 Audio, AAC 编码)
- iOS 录音默认格式: `.m4a` (MPEG-4 Audio, AAC 编码)
- MIME 类型映射:
  ```typescript
  const audioMimeTypes: Record<string, string> = {
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
  };
  ```

**时长获取方法**:
- `react-native-nitro-sound` 的 `stopRecorder()` 返回录音文件路径
- 录音时长通过 `onRecord` 回调的 `currentPosition` 字段实时获取
- 在录音停止时保存最后的 `currentPosition` 作为 `duration`
- 示例:
  ```typescript
  const { startRecorder, stopRecorder } = useSoundRecorder({
    onRecord: (event) => {
      // event.currentPosition 是当前录音时长（毫秒）
      setRecordingDuration(event.currentPosition);
    },
  });
  
  // 停止录音后，recordingDuration 就是最终时长
  const filePath = await stopRecorder();
  // 使用 recordingDuration 作为 duration 元数据
  ```

**Must NOT do**:
- 不要使用 `tp: 'AU'` 实体类型
- 不要跳过文件大小验证

**Parallelizable**: NO (depends on Task 2)

**References**:

**Pattern References**:
- `mobile/src/services/TinodeService.ts:475-542` - `sendFileMessage()` 实现模式
- `mobile/src/services/TinodeService.ts:544-600` - `uploadFile()` 上传模式
- `mobile/src/screens/ChatRoomScreen.tsx:720-745` - 失败消息重试机制

**API/Type References**:
- Drafty EX 实体格式: `{ tp: 'EX', data: { mime, val, name, size, duration } }`
- react-native-nitro-sound API:
  ```typescript
  import { useSoundRecorder, AudioEncoderAndroidType, AudioSourceAndroidType } from 'react-native-nitro-sound';
  
  const { startRecorder, stopRecorder, pauseRecorder, resumeRecorder, mmssss } = useSoundRecorder({
    subscriptionDuration: 0.1, // 每 100ms 更新一次
    onRecord: (event) => {
      // event.currentPosition: 当前录音时长（毫秒）
      // event.currentMetering: 当前音量级别（dB）
      // event.isRecording: 是否正在录音
      // event.ended: 录音是否结束
    },
  });
  ```

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 在 Android 设备上测试:
  1. 录制一段语音
  2. 松开按钮发送
  3. 看到发送中状态
  4. 发送成功后消息出现在聊天中
- [x] 文件大小限制测试:
  1. 录制超长语音（接近 5MB）
  2. 超过限制时显示错误提示
- [x] 失败重试测试:
  1. 断网发送语音
  2. 消息显示失败状态
  3. 点击重试，恢复网络后发送成功

**Commit**: YES
- Message: `feat(mobile): implement voice message sending via Tinode`
- Files: `mobile/src/services/TinodeService.ts`, `mobile/src/screens/ChatRoomScreen.tsx`
- Pre-commit: `npx tsc -p mobile/tsconfig.json --noEmit`

---

### Task 4: 实现 Mobile 语音播放

**What to do**:
- 创建 `AudioPlayer` 组件
- 播放/暂停按钮 + 进度条 + 时长显示
- 从 Drafty 实体解析音频 URL 和时长
- 在 `ChatRoomScreen` 消息渲染中添加音频消息识别
- 检测 `mime.startsWith('audio/')` 的 EX 实体
- 实现单例播放（播放新音频时自动停止当前播放）

**Must NOT do**:
- 不要自动播放
- 不要添加播放速度控制
- 不要添加波形显示

**Parallelizable**: YES (with Task 5, after Task 3)

**References**:

**Pattern References**:
- `mobile/src/screens/ChatRoomScreen.tsx` - 现有消息渲染逻辑
- react-native-nitro-sound `useSoundPlayer` hook

**API/Type References**:
- react-native-nitro-sound 播放器 API:
  ```typescript
  import { useSoundPlayer } from 'react-native-nitro-sound';
  
  const {
    startPlayer,    // (uri?: string) => Promise<void> - 开始播放
    stopPlayer,     // () => Promise<void> - 停止播放
    pausePlayer,    // () => Promise<void> - 暂停播放
    resumePlayer,   // () => Promise<void> - 恢复播放
    seekToPlayer,   // (ms: number) => Promise<void> - 跳转到指定位置
    setVolume,      // (volume: number) => Promise<void> - 设置音量 (0.0-1.0)
    state,          // { isPlaying, currentPosition, duration }
    mmssss,         // (ms: number) => string - 格式化时间 "00:00:00"
  } = useSoundPlayer({
    subscriptionDuration: 0.1, // 每 100ms 更新一次进度
    onPlayback: (event) => {
      // event.currentPosition: 当前播放位置（毫秒）
      // event.duration: 总时长（毫秒）
      // event.isPlaying: 是否正在播放
    },
    onPlaybackEnd: (event) => {
      // 播放完成回调
      // event.duration: 总时长
    },
  });
  ```

**播放器状态管理**:
- 创建 `mobile/src/store/audioPlayerStore.ts` 使用 Zustand（遵循项目现有状态管理模式）
- Store 结构：
  ```typescript
  import { create } from 'zustand';
  
  interface AudioPlayerStore {
    currentPlayingId: string | null;
    play: (messageId: string) => void;
    stop: () => void;
  }
  
  export const useAudioPlayerStore = create<AudioPlayerStore>((set) => ({
    currentPlayingId: null,
    play: (messageId) => set({ currentPlayingId: messageId }),
    stop: () => set({ currentPlayingId: null }),
  }));
  ```
- 参考模式：`mobile/src/store/authStore.ts` 的 Zustand 实现
- 每个 `AudioPlayer` 组件：
  1. 播放前调用 `audioPlayerStore.play(messageId)`
  2. Store 自动停止其他播放中的音频（通过 `currentPlayingId` 变化触发）
  3. 组件监听 `currentPlayingId`，如果不是自己则调用 `stopPlayer()`
  4. 组件卸载时检查 `currentPlayingId === messageId`，如果是则调用 `stop()`

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 在 Android 设备上测试:
  1. 收到语音消息
  2. 看到播放器 UI（播放按钮 + 进度条 + 时长）
  3. 点击播放，音频开始播放
  4. 点击暂停，音频暂停
  5. 拖动进度条，跳转到指定位置
  6. 播放完成后自动停止
- [x] 多消息测试:
  1. 播放一条语音
  2. 点击另一条语音
  3. 第一条自动停止，第二条开始播放

**Commit**: YES
- Message: `feat(mobile): implement voice message playback`
- Files: `mobile/src/components/AudioPlayer.tsx`, `mobile/src/screens/ChatRoomScreen.tsx`
- Pre-commit: `npx tsc -p mobile/tsconfig.json --noEmit`

---

### Task 5: 实现 Admin 语音播放

**What to do**:
- 在 `MerchantChat.tsx` 的 `renderContent()` 中添加音频消息识别
- 创建 Ant Design 风格的音频播放器组件
- 使用 HTML5 `<audio>` 元素 + 自定义控制 UI
- 播放/暂停按钮 + 进度条 + 时长显示

**Must NOT do**:
- 不要添加录音功能
- 不要使用浏览器原生 audio 控件
- 不要自动播放

**Parallelizable**: YES (with Task 4, after Task 3)

**References**:

**Pattern References**:
- `admin/src/pages/merchant/MerchantChat.tsx:590-714` - 现有 `renderContent()` 函数
- `admin/src/pages/merchant/MerchantChat.tsx:599-633` - 图片消息渲染模式
- `admin/src/pages/merchant/MerchantChat.tsx:635-708` - 文件消息渲染模式

**API/Type References**:
- HTML5 Audio API: `play()`, `pause()`, `currentTime`, `duration`
- Ant Design: `Button`, `Slider`, `Space`

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 在浏览器中测试:
  1. 打开 Admin 商家聊天界面
  2. 收到语音消息
  3. 看到自定义播放器 UI
  4. 点击播放，音频开始播放
  5. 点击暂停，音频暂停
  6. 拖动进度条，跳转到指定位置
- [x] 构建测试:
  ```bash
  cd admin && npm run build
  ```
- [x] 无 TypeScript 错误

**Commit**: YES
- Message: `feat(admin): implement voice message playback with custom UI`
- Files: `admin/src/pages/merchant/MerchantChat.tsx`
- Pre-commit: `cd admin && npm run build`

---

### Task 6: 消息列表语音预览

**What to do**:
- 在 `MessageScreen.tsx` 的消息预览中添加语音消息识别
- 显示格式：「【语音 12s】」（包含时长）
- 从 Drafty 实体解析时长信息

**Must NOT do**:
- 不要在预览中播放音频
- 不要显示波形缩略图

**Parallelizable**: NO (depends on Task 4)

**References**:

**Pattern References**:
- `mobile/src/screens/MessageScreen.tsx` - 消息列表渲染
- 现有图片预览格式：「【图片】」

**Acceptance Criteria**:

**Manual Execution Verification**:
- [x] 在 Android 设备上测试:
  1. 发送或收到语音消息
  2. 返回消息列表
  3. 看到「【语音 12s】」预览文本
  4. 时长显示正确

**Commit**: YES
- Message: `feat(mobile): show voice message duration in message list preview`
- Files: `mobile/src/screens/MessageScreen.tsx`
- Pre-commit: `npx tsc -p mobile/tsconfig.json --noEmit`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `feat(server): add audio file format support` | upload_handler.go | `make build` |
| 1 | `feat(mobile): install react-native-nitro-sound` | package.json, AndroidManifest.xml, Info.plist | `npm run android` |
| 2 | `feat(mobile): implement hold-to-record voice recorder` | VoiceRecorder.tsx, ChatRoomScreen.tsx | `tsc --noEmit` |
| 3 | `feat(mobile): implement voice message sending` | TinodeService.ts, ChatRoomScreen.tsx | `tsc --noEmit` |
| 4 | `feat(mobile): implement voice message playback` | AudioPlayer.tsx, ChatRoomScreen.tsx | `tsc --noEmit` |
| 5 | `feat(admin): implement voice message playback` | MerchantChat.tsx | `npm run build` |
| 6 | `feat(mobile): show voice duration in message preview` | MessageScreen.tsx | `tsc --noEmit` |

---

## Success Criteria

### Verification Commands
```bash
# Server
cd server && make build  # Expected: Build successful

# Mobile
cd mobile && npx tsc -p tsconfig.json --noEmit  # Expected: No errors

# Admin
cd admin && npm run build  # Expected: Build successful
```

### Final Checklist
- [x] Mobile 能录制语音消息（按住录音）
- [x] Mobile 能发送语音消息（≤60s, ≤5MB）
- [x] Mobile 能播放语音消息
- [x] Admin 能播放语音消息
- [x] 消息列表显示「【语音 12s】」
- [x] 所有构建通过
- [x] 无波形可视化（guardrail）
- [x] 无 Admin 录音功能（guardrail）
- [x] 无自动播放（guardrail）

---

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| react-native-nitro-sound 安装失败 | 🔴 High | 🟡 Medium | 检查 react-native-nitro-modules 版本兼容性，参考官方 troubleshooting |
| Android 权限被拒绝 | 🟡 Medium | 🟡 Medium | 显示友好提示，引导到设置 |
| 音频上传失败 | 🟡 Medium | 🟢 Low | 实现重试机制 |
| iOS 构建失败 | 🟡 Medium | 🟡 Medium | 标记为"未测试"，提供文档 |

**注意**: 如果 `react-native-nitro-sound` 安装失败，请参考官方文档 https://github.com/hyochan/react-native-nitro-sound 的 troubleshooting 部分。该库是 `react-native-audio-recorder-player` 的官方继任者，API 完全兼容。

---

## Time Estimate

| Task | Estimated Time | Actual Time | Notes |
|------|----------------|-------------|-------|
| Task 0 | 30 min | ___ | Backend change |
| Task 1 | 1 hour | ___ | Installation + rebuild |
| Task 2 | 3 hours | ___ | Recording UI |
| Task 3 | 2 hours | ___ | Sending logic |
| Task 4 | 2 hours | ___ | Mobile playback |
| Task 5 | 2 hours | ___ | Admin playback |
| Task 6 | 30 min | ___ | Message preview |
| **Total** | **11 hours** | ___ | ~1.5 days |

---

## Plan Metadata

**Created**: 2026-01-25  
**Last Updated**: 2026-01-25  
**Version**: 1.2 (Momus 审查通过)  
**Status**: ✅ Ready for execution  
**Estimated Completion**: 2026-01-27  

**Momus 审查历史**:
- 第一轮: REJECT（API 端点路径错误、音频格式说明缺失、回退库名称错误）
- 第二轮: REJECT（Task 4 播放器状态管理方案不明确）
- 第三轮: **OKAY** ✅
- 修复内容:
  - ✅ 修正 Task 0 的 API 端点路径（`/api/v1/upload` 而非 `/api/v1/upload/chat`）
  - ✅ 在 Task 3 添加音频格式说明和时长获取方法
  - ✅ 在 Task 4 添加完整的 API 导入和使用示例
  - ✅ 修正风险缓解策略中的回退库说明
  - ✅ 在 Task 4 明确播放器状态管理方案（使用 Zustand，提供完整 Store 结构）  

---

**计划已就绪，可以开始执行。运行 `/start-work` 开始实施。**
