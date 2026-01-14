# 作品案例详情页白屏问题修复

## 问题描述
点击作品案例后跳转到详情页时出现白屏。

## 根本原因分析
1. **原生模块未链接**：`react-native-linear-gradient` 可能未正确链接到原生代码
2. **数据验证缺失**：没有对传入的 `caseItem.images` 进行验证
3. **缺少错误处理**：组件崩溃时没有降级方案

## 修复内容

### 1. 添加数据验证 ([CaseScreens.tsx:235-251](mobile/src/screens/CaseScreens.tsx#L235-L251))
```typescript
// 数据验证：确保 images 数组存在且不为空
if (!caseItem || !caseItem.images || caseItem.images.length === 0) {
    return (
        <SafeAreaView style={styles.container}>
            {/* 显示错误提示 */}
        </SafeAreaView>
    );
}
```

### 2. LinearGradient 降级处理 ([HeroSection.tsx:4-11](mobile/src/components/case/HeroSection.tsx#L4-L11))
```typescript
// 尝试导入 LinearGradient，如果失败则使用降级方案
let LinearGradient: any;
try {
  LinearGradient = require('react-native-linear-gradient').default;
} catch (e) {
  console.warn('LinearGradient not available, using fallback');
  LinearGradient = null;
}
```

### 3. 添加文字阴影提升可读性 ([HeroSection.tsx:86-103](mobile/src/components/case/HeroSection.tsx#L86-L103))
```typescript
heroTitle: {
    // ...
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
}
```

## 测试步骤

### 方法 1：重新构建应用（推荐）
```bash
# 1. 停止当前运行的应用
# 2. 清理缓存
cd mobile
npm start -- --reset-cache

# 3. 在新终端重新构建 Android
npm run android

# 或者重新构建 iOS
npm run ios
```

### 方法 2：仅重启 Metro Bundler
```bash
cd mobile
npm start -- --reset-cache
```
然后在设备上重新加载应用（摇一摇设备 → Reload）

## 验证清单
- [ ] 点击作品案例卡片后能正常跳转
- [ ] 详情页显示案例图片和信息
- [ ] 滚动页面时有视差效果
- [ ] 图片查看器可以正常打开
- [ ] 如果数据缺失，显示友好的错误提示

## 如果问题仍然存在

### 1. 检查 Metro Bundler 日志
查看终端输出，看是否有 JavaScript 错误：
```
ERROR  Error: ...
```

### 2. 检查原生日志
**Android:**
```bash
adb logcat | grep -i "react"
```

**iOS:**
在 Xcode 中查看控制台输出

### 3. 重新链接原生模块
```bash
cd mobile/android
./gradlew clean

cd ..
npm run android
```

### 4. 完全重装依赖
```bash
cd mobile
rm -rf node_modules
rm package-lock.json
npm install
npm run android
```

## 后续优化建议
1. 添加全局错误边界组件
2. 使用 React Native 的 `ErrorBoundary` 捕获组件错误
3. 添加更详细的日志记录
4. 考虑使用 Sentry 等错误监控服务

## 相关文件
- [mobile/src/screens/CaseScreens.tsx](mobile/src/screens/CaseScreens.tsx)
- [mobile/src/components/case/HeroSection.tsx](mobile/src/components/case/HeroSection.tsx)
- [mobile/src/components/case/AnimatedHeader.tsx](mobile/src/components/case/AnimatedHeader.tsx)
- [mobile/src/components/case/InfoCard.tsx](mobile/src/components/case/InfoCard.tsx)
- [mobile/src/components/case/ImageGrid.tsx](mobile/src/components/case/ImageGrid.tsx)
