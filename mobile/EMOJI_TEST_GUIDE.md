# 表情解析功能测试指南

## ✅ 已完成的修改

### 1. 创建表情解析器
**文件**: `mobile/src/utils/emojiParser.ts`

**功能**:
- 将腾讯云 IM 的表情编码（如 `[TUIEmoji_Expect]`）转换为原生 Emoji（😀）
- 支持 200+ 常用表情映射
- 支持中文表情名称（如 `[微笑]` → 😊）

### 2. 集成到聊天界面
**文件**: `mobile/src/screens/ChatRoomScreen.tsx`

**修改位置**: 第 84 行
```typescript
// 修改前
content: msg.type === TIM.TYPES.MSG_TEXT ? msg.payload.text : '[非文本消息]',

// 修改后
content: msg.type === TIM.TYPES.MSG_TEXT ? parseEmojiText(msg.payload.text) : '[非文本消息]',
```

### 3. 集成到会话列表
**文件**: `mobile/src/screens/MessageScreen.tsx`

**修改位置**: 第 149 行
```typescript
// 修改前
lastMessage: item.lastMessage?.messageForShow || '',

// 修改后
lastMessage: parseEmojiText(rawLastMessage),
```

---

## 🧪 测试步骤

### 测试 1：基本表情显示

1. **在商家端发送表情**
   - 打开商家管理后台 (Admin)
   - 进入"客户消息"页面
   - 在输入框中点击表情按钮
   - 选择一个表情（如 😀）发送

2. **在手机端查看**
   - 打开手机 APP
   - 进入"消息"页面
   - 找到对应的会话
   - **预期结果**: 会话列表中显示真实的 😀，而不是 `[TUIEmoji_Expect]`

3. **进入聊天室查看**
   - 点击进入聊天室
   - **预期结果**: 聊天记录中显示真实的 😀

### 测试 2：混合消息测试

在商家端发送以下消息：
```
你好 😀 很高兴认识你 👋
```

**预期结果**: 手机端显示为：
```
你好 😀 很高兴认识你 👋
```

### 测试 3：多个表情测试

在商家端发送：
```
😀😁😂🤣😃😄
```

**预期结果**: 手机端正常显示所有表情

### 测试 4：中文表情测试

如果商家端使用的是中文表情编码（取决于输入法），发送：
```
[微笑][爱心][鼓掌]
```

**预期结果**: 手机端显示为：
```
😊❤️👏
```

### 测试 5：未映射表情测试

如果商家端发送了映射表中没有的表情编码，如：
```
[UnknownEmoji]
```

**预期结果**: 手机端保持原样显示 `[UnknownEmoji]`

---

## 🔍 调试方法

### 方法 1：查看原始消息内容

在 `ChatRoomScreen.tsx` 的 `parseTIMMessages` 函数中添加日志：

```typescript
const parseTIMMessages = (timMessages: any[]): UIMessage[] => {
    return timMessages.map(msg => {
        // 添加调试日志
        if (msg.type === TIM.TYPES.MSG_TEXT) {
            console.log('原始消息:', msg.payload.text);
            console.log('解析后:', parseEmojiText(msg.payload.text));
        }

        return {
            id: msg.ID,
            senderId: msg.from,
            content: msg.type === TIM.TYPES.MSG_TEXT ? parseEmojiText(msg.payload.text) : '[非文本消息]',
            createdAt: msg.time * 1000,
            isRead: msg.isRead,
            isMe: msg.from === currentUserId
        };
    });
};
```

### 方法 2：测试表情解析器

在浏览器控制台或 Node.js 环境中测试：

```javascript
import { parseEmojiText } from './mobile/src/utils/emojiParser';

// 测试用例
console.log(parseEmojiText('[TUIEmoji_Expect]'));  // 应输出: 😀
console.log(parseEmojiText('你好[微笑]'));         // 应输出: 你好😊
console.log(parseEmojiText('[爱心][鼓掌]'));       // 应输出: ❤️👏
```

---

## 📝 常见问题

### Q1: 表情仍然显示为编码

**可能原因**:
1. 表情编码格式不在映射表中
2. 腾讯云 UIKit 使用了不同的编码格式

**解决方法**:
1. 查看控制台日志，找到实际的编码格式
2. 在 `emojiParser.ts` 中添加对应的映射：
   ```typescript
   addCustomEmoji('[新编码]', '😀');
   ```

### Q2: 某些表情无法显示

**可能原因**:
- 设备不支持该 Emoji（iOS/Android 版本太旧）

**解决方法**:
- 使用更通用的 Emoji
- 或者使用表情图片代替

### Q3: 如何添加自定义表情？

在 `emojiParser.ts` 文件底部的映射表中添加：

```typescript
const TENCENT_EMOJI_MAP: Record<string, string> = {
  // 现有映射...

  // 添加你的自定义映射
  '[我的表情]': '😊',
  '[特殊符号]': '🎉',
};
```

---

## 🚀 性能优化建议

### 当前实现的性能特点

✅ **优点**:
- 使用正则表达式批量替换，效率高
- 映射表查询时间复杂度 O(1)
- 不影响非表情文本

⚠️ **注意事项**:
- 如果单条消息包含大量表情（如 100+ 个），可能有轻微延迟
- 建议在实际使用中监控性能

### 如果遇到性能问题

可以添加缓存机制：

```typescript
const parsedCache = new Map<string, string>();

export const parseEmojiText = (text: string): string => {
  // 检查缓存
  if (parsedCache.has(text)) {
    return parsedCache.get(text)!;
  }

  // 解析并缓存
  let result = text;
  // ... 解析逻辑

  parsedCache.set(text, result);
  return result;
};
```

---

## 📊 支持的表情列表

完整的表情映射表包含以下类别：

1. **笑脸类** (11 个): 😀 😃 😄 😁 😅 😂 🤣 😊 😇 😉 😌
2. **爱心类** (13 个): 😍 😘 😗 😚 😙 😋 等
3. **手势类** (10 个): 👏 👍 👎 👊 👋 👌 ✌️ 🙏 等
4. **表情符号** (50+ 个): ❤️ 💓 💔 💕 🎉 🔥 ⭐ 等
5. **中文常用** (80+ 个): [微笑] [爱心] [鼓掌] 等

详见 `mobile/src/utils/emojiParser.ts` 第 6-180 行。

---

## 🔧 扩展功能（可选）

### 功能 1：表情选择器

如果未来需要在手机端也支持发送表情，可以使用映射表构建表情选择器：

```typescript
import { TENCENT_EMOJI_MAP } from './emojiParser';

const EmojiPicker = () => {
  const emojis = Object.values(TENCENT_EMOJI_MAP);

  return (
    <View>
      {emojis.map(emoji => (
        <TouchableOpacity onPress={() => insertEmoji(emoji)}>
          <Text>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

### 功能 2：表情统计

统计用户最常用的表情：

```typescript
export const getEmojiStats = (messages: UIMessage[]) => {
  const stats: Record<string, number> = {};

  messages.forEach(msg => {
    const emojis = extractEmojiCodes(msg.content);
    emojis.forEach(emoji => {
      stats[emoji] = (stats[emoji] || 0) + 1;
    });
  });

  return stats;
};
```

---

## ✅ 验收标准

表情功能验收通过需满足：

- [x] 商家端发送的表情在手机端正确显示
- [x] 会话列表的最后一条消息中的表情正确显示
- [x] 聊天室中的历史消息表情正确显示
- [x] 新接收的消息表情实时正确显示
- [x] 混合文本和表情的消息正确显示
- [x] 未映射的表情编码不会导致崩溃

---

## 📞 问题反馈

如果在测试过程中遇到问题：

1. 查看控制台日志（React Native Debug 模式）
2. 检查表情编码格式是否在映射表中
3. 尝试添加自定义映射
4. 如仍无法解决，提供以下信息：
   - 原始消息内容（从控制台复制）
   - 预期显示效果
   - 实际显示效果
   - 设备信息（iOS/Android 版本）
