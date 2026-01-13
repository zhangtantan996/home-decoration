# iOS 26 Liquid Glass 升级指南

> **文档版本**: v1.0
> **最后更新**: 2026-01-07
> **适用范围**: React Native 0.83 移动端应用

---

## 📖 概述

本文档记录了将移动应用升级到 iOS 26 Liquid Glass 设计语言的完整方案，包括技术实现、工作量评估和迁移步骤。

### 什么是 Liquid Glass？

iOS 26 引入的全新设计语言，是自 iOS 7 以来最大的视觉改版。主要特性包括：

- 🔮 **动态折射**: 实时反射和折射背景内容
- 💧 **流动变形**: 交互时的流体动画效果
- 🎨 **多层深度**: 支持多层玻璃叠加
- 🌈 **自适应配色**: 自动适应明暗背景

**技术实现**:
- Core Animation + SDF (Signed Distance Fields)
- SwiftUI 新增 `.glassEffect()` 修饰符
- UIKit 增强的 `UIVisualEffectView`

**参考资料**:
- [Apple 官方文档](https://www.apple.com/ios/ios-26/)
- [MacRumors 详细报道](https://www.macrumors.com/guide/ios-26/)
- [GitConnected 技术分析](https://levelup.gitconnected.com/ios-26-liquid-glass)

---

## 🎯 当前项目状态

### 现有毛玻璃实现

| 组件 | 库 | 使用场景 | 文件路径 |
|------|-----|---------|----------|
| `BlurView` | `expo-blur` | 日期选择器弹窗 | `src/components/DateRangePicker.tsx:15` |
| `rgba()` 半透明 | 原生 CSS | Modal 遮罩层 | 15+ 文件 |

### 半透明背景使用统计

**Modal 弹窗** (10 处):
- `BookingScreen.tsx:1236` - 预约确认弹窗
- `ChatRoomScreen.tsx:919` - 聊天操作菜单
- `CaseScreens.tsx:668` - 图片预览遮罩
- `HomeScreen.tsx:1528` - 筛选面板
- `AccountSecurityScreen.tsx:175` - 安全提示
- 其他 5 处 Modal 组件

**其他场景** (5+ 处):
- 图片查看器背景
- 底部操作面板
- 通知卡片

---

## 🛠 技术方案

### 推荐方案：使用官方库

**库名称**: `@callstack/liquid-glass`
**维护方**: Callstack (React Native 官方合作伙伴)
**文档**: [Callstack Liquid Glass](https://callstack.com/liquid-glass)

**核心优势**:
- ✅ 官方推荐的 React Native 实现
- ✅ 自动处理 iOS < 26 降级
- ✅ 支持 Android 降级 (显示普通 View)
- ✅ API 设计与 `expo-blur` 相似，迁移成本低

### 技术要求

| 项目 | 最低版本 | 当前版本 | 状态 |
|------|---------|---------|------|
| iOS | 26.0 | - | ⚠️ 需升级 |
| React Native | 0.80+ | 0.83 | ✅ 满足 |
| Xcode | 26.0+ | - | ⚠️ 需检查 |
| 设备芯片 | A13+ | - | ✅ iPhone 11+ |

**注意**: iOS 26 不支持 iPhone XS/XR 及以下机型。

---

## 📋 迁移步骤

### 阶段 1: 最小验证 (20 分钟)

#### 1.1 安装依赖

```bash
cd mobile
npm install @callstack/liquid-glass
cd ios && pod install
```

#### 1.2 升级 iOS 最低版本

**文件**: `mobile/ios/Podfile`

```diff
- platform :ios, min_ios_version_supported
+ platform :ios, '26.0'
```

#### 1.3 替换核心组件

**文件**: `mobile/src/components/DateRangePicker.tsx`

**修改前**:
```tsx
import { BlurView } from 'expo-blur';

<BlurView intensity={80} tint="light" style={styles.blurContent}>
    {renderModalContent()}
</BlurView>
```

**修改后**:
```tsx
import { LiquidGlassView } from '@callstack/liquid-glass';

<LiquidGlassView
    tint="light"
    effect="regular"  // 可选: "clear" | "regular"
    style={styles.blurContent}
>
    {renderModalContent()}
</LiquidGlassView>
```

#### 1.4 测试验证

```bash
# 启动 Metro
npm start

# 运行 iOS (需要真机或 iOS 26+ 模拟器)
npm run ios
```

---

### 阶段 2: 核心场景升级 (4-6 小时)

#### 2.1 Modal 弹窗改造 (优先级 P0)

**改造模式**:

```tsx
// 旧代码
<View style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
    <View style={styles.modalContent}>
        <Text>弹窗内容</Text>
    </View>
</View>

// 新代码
import { LiquidGlassView } from '@callstack/liquid-glass';

<LiquidGlassView tint="dark" effect="regular">
    <View style={styles.modalContent}>
        <Text>弹窗内容</Text>
    </View>
</LiquidGlassView>
```

#### 2.2 改造清单

**必改文件** (10 个):
- [ ] `BookingScreen.tsx:1236` - 预约确认弹窗
- [ ] `ChatRoomScreen.tsx:919` - 聊天操作菜单
- [ ] `CaseScreens.tsx:668` - 图片预览遮罩
- [ ] `HomeScreen.tsx:1528` - 筛选面板
- [ ] `AccountSecurityScreen.tsx:175` - 安全提示
- [ ] `DesignFilesScreen.tsx:376` - 文件预览
- [ ] `ChatSettingsScreen.tsx:397` - 设置弹窗
- [ ] `BillScreen.tsx` - 账单详情
- [ ] `AfterSalesScreen.tsx` - 售后弹窗
- [ ] `OrderDetailScreen.tsx` - 订单操作面板

---

### 阶段 3: 全面升级 (1-2 天，可选)

#### 3.1 其他半透明元素

**适合使用 Liquid Glass 的场景**:
- ✅ 导航栏背景
- ✅ 底部操作面板
- ✅ 卡片悬浮层
- ✅ 通知横幅
- ✅ 按钮高亮状态

**不适合的场景**:
- ❌ 长列表背景 (性能问题)
- ❌ 文字密集区域 (可读性问题)
- ❌ 全屏背景 (视觉疲劳)

#### 3.2 性能优化建议

```tsx
// ✅ 推荐: 局部使用
<LiquidGlassView tint="light">
    <TouchableOpacity style={styles.button}>
        <Text>确认</Text>
    </TouchableOpacity>
</LiquidGlassView>

// ❌ 不推荐: 长列表中使用
<FlatList
    data={items}
    renderItem={({ item }) => (
        <LiquidGlassView> {/* 会影响滚动性能 */}
            <Text>{item.name}</Text>
        </LiquidGlassView>
    )}
/>
```

---

## 🔄 兼容性处理

### 自动降级

`@callstack/liquid-glass` 自动处理降级逻辑：

| 平台/版本 | 渲染结果 |
|----------|---------|
| iOS 26+ | 完整 Liquid Glass 效果 |
| iOS < 26 | 普通 `View` (不透明) |
| Android | 普通 `View` (不透明) |

### 手动控制降级

如需自定义降级样式：

```tsx
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';

function Modal({ children }) {
    if (isLiquidGlassSupported()) {
        return (
            <LiquidGlassView tint="dark" effect="regular">
                {children}
            </LiquidGlassView>
        );
    }

    // 降级方案：使用半透明背景
    return (
        <View style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
            {children}
        </View>
    );
}
```

### 无障碍支持

iOS 26 用户可在系统设置中调整 Liquid Glass 强度：

**设置路径**: 设置 > 辅助功能 > 显示与文字大小 > 降低透明度

```tsx
// 库会自动响应系统设置，无需额外处理
<LiquidGlassView tint="light">
    {/* 内容会自动适配用户偏好 */}
</LiquidGlassView>
```

---

## 📊 工作量评估

| 阶段 | 工作量 | 内容 | 文件数 |
|------|--------|------|--------|
| **阶段 1: 最小验证** | 20 分钟 | 安装库 + 修改 1 个组件 | 3 个 |
| **阶段 2: 核心场景** | 4-6 小时 | 升级所有 Modal 弹窗 | 10 个 |
| **阶段 3: 全面升级** | 1-2 天 | 替换所有半透明背景 | 15 个 |
| **性能优化与测试** | 半天 | 调优参数、真机测试 | - |
| **总计** | **2-3 天** | - | **约 20 个文件** |

---

## ⚙️ API 参考

### LiquidGlassView 组件

```tsx
import { LiquidGlassView } from '@callstack/liquid-glass';

<LiquidGlassView
    tint="light" | "dark"          // 色调: 明亮 | 暗黑
    effect="regular" | "clear"      // 效果模式
    style={StyleSheet}              // 自定义样式
    reducedTransparencyFallback={View} // 降级组件 (可选)
>
    {children}
</LiquidGlassView>
```

### 工具函数

```tsx
import { isLiquidGlassSupported } from '@callstack/liquid-glass';

// 检查当前设备是否支持 Liquid Glass
const supported = isLiquidGlassSupported();
// 返回: boolean
```

---

## 🚨 注意事项

### 1. 硬件限制

- ✅ **支持设备**: iPhone 11 及以上 (A13 芯片+)
- ❌ **不支持**: iPhone XS, XS Max, XR 及更早机型

### 2. 性能影响

- **GPU 消耗**: Liquid Glass 使用实时 GPU 加速模糊
- **建议**: 单屏不超过 5 个 LiquidGlassView 组件
- **避免**: 在 ScrollView/FlatList 的 item 中使用

### 3. 视觉设计

```tsx
// ✅ 推荐: 按钮、卡片、Modal
<LiquidGlassView tint="light">
    <Button title="确认" />
</LiquidGlassView>

// ⚠️ 谨慎: 导航栏 (需考虑文字对比度)
<LiquidGlassView tint="dark">
    <NavigationBar />
</LiquidGlassView>

// ❌ 不推荐: 大面积背景
<LiquidGlassView style={{ flex: 1 }}>
    <ScrollView>...</ScrollView>
</LiquidGlassView>
```

### 4. 调试技巧

```bash
# 查看 iOS 版本
xcrun simctl list devices | grep "iOS 26"

# 检查 Xcode 版本
xcodebuild -version

# 清理缓存
cd ios && pod deintegrate && pod install
```

---

## 🔗 参考资料

### 官方文档
- [Apple iOS 26 官网](https://www.apple.com/ios/ios-26/)
- [iOS 26 Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/liquid-glass/)
- [WWDC 2025 Session: Liquid Glass 设计语言](https://developer.apple.com/videos/wwdc2025/)

### 技术文章
- [MacRumors: iOS 26 Liquid Glass 深度解析](https://www.macrumors.com/guide/ios-26/)
- [GitConnected: iOS 26 Liquid Glass API 实现](https://levelup.gitconnected.com/ios-26-liquid-glass-swiftui)
- [Medium: React Native Liquid Glass 最佳实践](https://medium.com/callstack/react-native-liquid-glass)

### 社区资源
- [Callstack Liquid Glass 官方文档](https://callstack.com/liquid-glass)
- [GitHub: @callstack/liquid-glass](https://github.com/callstack/liquid-glass)
- [React Native Community 讨论](https://github.com/react-native-community/discussions)

---

## 📝 变更日志

### v1.0 (2026-01-07)
- ✅ 初始文档创建
- ✅ 完成技术方案调研
- ✅ 整理现有代码分析
- ✅ 制定迁移路线图

---

## 🤝 贡献者

- **调研**: Claude Code
- **审核**: 待定
- **实施**: 待定

---

**最后更新**: 2026-01-07
**文档维护**: 请在迭代时更新此文档的变更日志部分
