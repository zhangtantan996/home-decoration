# Tinode 集成指南

**最后更新**: 2026-01-25

本文档介绍了如何将 Tinode 即时通讯系统集成到家装设计平台中。Tinode 是一个基于 Go 语言开发的开源即时通讯平台，支持多端同步、离线推送和丰富的消息类型。

## 集成步骤

### 1. 安装 SDK

在前端项目（Admin 或 Mobile）中安装 Tinode SDK：

```bash
npm install tinode-sdk
```

对于 React Native 环境，还需要安装 AsyncStorage 用于持久化存储：

```bash
npm install @react-native-async-storage/async-storage
```

### 2. 初始化

在应用启动时初始化 Tinode 实例并连接到服务器。

```typescript
import { Tinode } from 'tinode-sdk';

const tinode = new Tinode({
  appName: 'HomeDecoration',
  host: 'api.yourdomain.com/tinode/ws', // 生产环境地址
  apiKey: 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K', // Tinode 默认 API Key
  transport: 'ws',
  secure: true, // 使用 wss 协议
});

// 绑定基本事件
tinode.onConnect = () => console.log('Connected to Tinode');
tinode.onDisconnect = (err) => console.log('Disconnected', err);

await tinode.connect();
```

### 3. 认证

平台复用现有的 JWT 认证体系。后端会生成一个兼容 Tinode 格式的 Token。

```typescript
// 使用从后端获取的 tinodeToken 进行登录
const loginResult = await tinode.loginToken(tinodeToken);

// 登录后订阅 "me" topic 以接收会话更新
const me = tinode.getMeTopic();
await me.subscribe();
```

## SDK 使用

### Web/Admin 集成

在 Admin 后端管理系统中，IM 主要用于客服和设计师与客户的沟通。

1.  **会话列表**: 通过 `tinode.getMeTopic().contacts()` 获取。
2.  **发送消息**: 获取对应 topic 后调用 `publishMessage`。
3.  **消息格式**: 支持 Drafty 格式，可发送富文本、图片等。

### React Native 集成

在移动端，通过封装 `TinodeService` 单例来管理连接生命周期和消息收发。

-   **后台保活**: 结合 React Native 的生命周期管理，在应用切到后台时保持连接或通过推送通知接收新消息。
-   **离线推送**: 集成 FCM (Android) 和 APNs (iOS)，Tinode 服务器在用户离线时会自动发送推送。

## 配置说明

### 服务器配置 (`tinode.conf`)

Tinode 服务器的核心配置包括数据库连接、JWT 密钥和推送服务。

```json
{
  "store_config": {
    "use_adapter": "postgres",
    "postgres": {
      "dsn": "postgres://user:password@localhost:5432/tinode"
    }
  },
  "auth_config": {
    "token": {
      "key": "your-jwt-secret",
      "expire_in": 604800
    }
  },
  "push": [
    {
      "name": "fcm",
      "config": { "enabled": true, "credentials": { "api_key": "..." } }
    }
  ]
}
```

### 客户端配置

客户端需要根据环境配置不同的 WebSocket 地址：
-   **开发环境**: `ws://localhost:6061/v0/channels`
-   **生产环境**: `wss://api.yourdomain.com/tinode/ws`

## 代码示例

### 发送文本消息

```typescript
async function sendMessage(topicName, text) {
  const topic = tinode.getTopic(topicName);
  if (!topic.isSubscribed()) {
    await topic.subscribe();
  }
  return topic.publishMessage(text);
}
```

### 发送图片消息

发送图片需要先上传文件到 Tinode 的文件服务器。

```typescript
async function sendImage(topicName, fileUri) {
  const topic = tinode.getTopic(topicName);
  
  // 1. 获取上传助手
  const helper = tinode.getLargeFileHelper();
  
  // 2. 构造 FormData 并上传
  const formData = new FormData();
  formData.append('file', { uri: fileUri, type: 'image/jpeg', name: 'photo.jpg' });
  const upload = await helper.upload(formData);
  
  // 3. 发送包含图片实体的消息
  return topic.publishMessage({
    txt: ' ',
    ent: [{
      tp: 'IM',
      data: {
        mime: 'image/jpeg',
        val: upload.url,
        width: 800,
        height: 600
      }
    }]
  });
}
```

### 标记已读

```typescript
function markAsRead(topicName, seqId) {
  const topic = tinode.getTopic(topicName);
  topic.noteRead(seqId);
}
```
