# Document Picker 迁移说明

## 问题
`react-native-document-picker` 包已被弃用并重命名为 `@react-native-documents/picker`。

## 错误信息
```
Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'RNDocumentPicker' could not be found.
```

## 解决方案

### 1. 卸载旧包并安装新包

```bash
cd mobile
npm uninstall react-native-document-picker
npm install @react-native-documents/picker
```

### 2. 更新导入语句

**修改前：**
```typescript
import DocumentPicker from 'react-native-document-picker';
```

**修改后：**
```typescript
import DocumentPicker from '@react-native-documents/picker';
```

### 3. API 使用保持不变

新包的 API 与旧包完全兼容，无需修改使用代码：

```typescript
// 文件选择
const handleFile = async () => {
    try {
        const res = await DocumentPicker.pick({
            type: [DocumentPicker.types.allFiles],
        });
        const file = res[0];
        // ... 处理文件
    } catch (err) {
        if (DocumentPicker.isCancel(err)) {
            // 用户取消
        } else {
            console.error('DocumentPicker Error:', err);
        }
    }
};
```

### 4. 清理并重新构建

```bash
# 清理 Android 构建缓存
cd android
./gradlew clean

# 重新构建应用
cd ..
npm run android
```

### 5. iOS 额外步骤（如需要）

```bash
cd ios
pod install
cd ..
npm run ios
```

## 已修改的文件

- ✅ [mobile/src/screens/ChatRoomScreen.tsx](mobile/src/screens/ChatRoomScreen.tsx) - 更新导入语句
- ✅ [mobile/package.json](mobile/package.json) - 包依赖更新

## 参考链接

- [迁移说明](https://shorturl.at/QYT4t)
- [新包 GitHub](https://github.com/react-native-documents/picker)

## 迁移完成时间

2026-01-01
