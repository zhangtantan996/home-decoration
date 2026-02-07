import { SecureStorage } from '../utils/SecureStorage';
import { Tinode } from 'tinode-sdk';
import { tinodeApi } from './api';
import { getApiBaseUrl, getApiUrl } from '../config';
import { TINODE_CONFIG } from '../config/tinode';
import ReactNativeBlobUtil from 'react-native-blob-util';

type Listener = (...args: unknown[]) => void;

// Minimal EventEmitter for React Native (Node's `events` module is not available).
class SimpleEventEmitter {
    private listeners: Record<string, Set<Listener>> = {};

    on(event: string, listener: Listener): this {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
        return this;
    }

    removeListener(event: string, listener: Listener): this {
        this.listeners[event]?.delete(listener);
        return this;
    }

    emit(event: string, ...args: unknown[]): boolean {
        const set = this.listeners[event];
        if (!set || set.size === 0) return false;
        // Copy to avoid issues if listeners mutate during emit.
        [...set].forEach((fn) => fn(...args));
        return true;
    }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const hasExplicitPort = (host: string): boolean => /:\d+$/.test(host) || /\]:\d+$/.test(host);

const withDefaultTinodePort = (host: string): string => {
    const normalized = host.trim();
    if (!normalized) return '';
    return hasExplicitPort(normalized) ? normalized : `${normalized}:6060`;
};

const hostNameOf = (host: string): string => {
    try {
        return new URL(`http://${host}`).hostname.toLowerCase();
    } catch {
        return host.toLowerCase();
    }
};

const deriveTinodeHostFromApi = (): string => {
    try {
        const url = new URL(getApiBaseUrl());
        return url.hostname ? `${url.hostname}:6060` : '';
    } catch {
        return '';
    }
};

// 配置
const getTinodeHost = (): string => {
    const explicitHost = withDefaultTinodePort(TINODE_CONFIG.HOST);
    const derivedHost = deriveTinodeHostFromApi();

    if (explicitHost) {
        // Guard against a common Android setup pitfall:
        // API points to LAN/10.0.2.2, but Tinode is hardcoded to localhost in .env.
        const explicitHostname = hostNameOf(explicitHost);
        const derivedHostname = hostNameOf(derivedHost);
        const explicitIsLoopback = LOOPBACK_HOSTS.has(explicitHostname);
        const derivedIsLoopback = LOOPBACK_HOSTS.has(derivedHostname);

        if (explicitIsLoopback && derivedHost && !derivedIsLoopback) {
            console.warn(
                `[Tinode] TINODE_SERVER_URL=${explicitHost} points to loopback, ` +
                    `but API host is ${derivedHost}. Using API host for Tinode.`
            );
            return derivedHost;
        }

        return explicitHost;
    }

    if (derivedHost) {
        return derivedHost;
    }

    // Fallback to previous behavior.
    return __DEV__ ? 'localhost:6060' : 'api.yourdomain.com:6060';
};

const CONFIG = {
    // Tinode SDK expects host in the form "host:port" (no scheme/path).
    // Tinode server listens on 6060 for HTTP/WebSocket, 6061 is gRPC.
    SERVER_URL: getTinodeHost(),
    API_KEY: TINODE_CONFIG.API_KEY,
    APP_NAME: TINODE_CONFIG.APP_NAME,
};

/**
 * Tinode IM 服务（单例）
 */
class TinodeService extends SimpleEventEmitter {
    private static instance: TinodeService;
    private tinode: any | null = null;
    private me: any | null = null;
    private connected: boolean = false;
    private initPromise: Promise<boolean> | null = null;
    private reconnectTimer: any | null = null;
	private userIdCache: Map<string, string> = new Map();
	private prefetchInFlight: Map<string, Promise<void>> = new Map();

    private constructor() {
        super();
    }

    static getInstance(): TinodeService {
        if (!TinodeService.instance) {
            TinodeService.instance = new TinodeService();
        }
        return TinodeService.instance;
    }

    /**
     * 初始化并连接到 Tinode 服务器
     */
    async init(tinodeToken: string): Promise<boolean> {
        if (this.connected && this.tinode && this.me) {
            return true;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
            console.log('[Tinode] 初始化中...');
            console.log('[Tinode] Server:', CONFIG.SERVER_URL, 'secure:', !__DEV__);

            if (!CONFIG.API_KEY) {
                console.error(
                    '[Tinode] 初始化失败: 未配置 TINODE_API_KEY（Tinode API Key）。' +
                        '请在 mobile/.env 中设置（参考 mobile/.env.example），然后重新编译 App。'
                );
                this.connected = false;
                return false;
            }

            // If there is a previous instance, disconnect it to avoid multiple sockets.
            try {
                this.tinode?.disconnect?.();
            } catch {
                // ignore
            }
            this.connected = false;
            this.tinode = null;
            this.me = null;

            // 创建 Tinode 实例
            this.tinode = new Tinode({
                appName: CONFIG.APP_NAME,
                host: CONFIG.SERVER_URL,
                apiKey: CONFIG.API_KEY,
                transport: 'ws',
                secure: !__DEV__,  // 生产环境使用 WSS
            });

            // 绑定事件监听器
            this.tinode.onConnect = this.onConnect.bind(this);
            this.tinode.onDisconnect = this.onDisconnect.bind(this);
            this.tinode.onMessage = this.onMessage.bind(this);

            // 连接到服务器
            await this.tinode.connect();
            console.log('[Tinode] WebSocket 已连接');

            // 使用 Token 登录
            const loginResult = await this.tinode.loginToken(tinodeToken);
            console.log('[Tinode] 登录成功:', loginResult);

            // 订阅 "me" topic（必需，用于接收会话列表）
            this.me = this.tinode.getMeTopic();

            // `me.subscribe(getParams)` resolves on ctrl ack; the actual meta{sub} may arrive later.
            // Attach handlers BEFORE subscribing so we can refresh the UI when subs are processed.
            let subsResolved = false;
            let resolveSubs!: () => void;
            const waitSubs = new Promise<void>((resolve) => {
                resolveSubs = resolve;
            });

            this.me.onPres = (pres: unknown) => {
                this.emit('pres', pres);
            };
            this.me.onContactUpdate = (what: unknown, cont: unknown) => {
                this.emit('contact-update', { what, cont });
            };
            this.me.onSubsUpdated = (keys: unknown, count?: unknown) => {
                this.emit('subs-updated', { keys, count });
                if (!subsResolved) {
                    subsResolved = true;
                    resolveSubs();
                }
            };

            // Fetch topic description and subscriptions.
            // Tinode SDK expects `get` params object (no nested `get:`).
            const getParams = this.me.startMetaQuery().withDesc().withSub(undefined, 200).build();
            await this.me.subscribe(getParams);

            // Best-effort: wait briefly for the initial subs list to be processed.
            await Promise.race([
                waitSubs,
                new Promise((resolve) => setTimeout(resolve, 1500)),
            ]);

            this.connected = true;
            this.emit('connected');
            console.log('[Tinode] 初始化成功');

            return true;
            } catch (error) {
            console.error('[Tinode] 初始化失败:', error);
            const msg = String((error as any)?.message || '');
            if (msg.includes('503')) {
                console.warn(
                    '[Tinode] 503 Service Unavailable: 通常是 Tinode 容器未启动/未就绪，或 Tinode 无法连接数据库。' +
                        '请检查 docker 容器与日志（decorating_tinode），并确认已配置 TINODE_DATABASE_DSN 等环境变量。'
                );
            }
            this.connected = false;
            return false;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    /**
     * 连接成功回调
     */
    private onConnect() {
        console.log('[Tinode] ✅ Socket connected');

        // 清除重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * 断开连接回调
     */
    private onDisconnect(error?: any) {
        console.log('[Tinode] ❌ 已断开:', error);
        this.connected = false;
        this.emit('disconnected', error);

        // 自动重连（3 秒后）
        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => this.reconnect(), 3000);
        }
    }

    /**
     * 收到消息回调
     */
    private onMessage(message: any) {
        console.log('[Tinode] 📩 收到消息:', message);
        this.emit('message', message);
    }

    /**
     * 重新连接
     */
    private async reconnect() {
        if (this.connected) return;

        console.log('[Tinode] 🔄 尝试重连...');

        try {
            const tinodeToken = await SecureStorage.getTinodeToken();
            if (tinodeToken) {
                await this.init(tinodeToken);
            }
        } catch (error) {
            console.error('[Tinode] 重连失败:', error);
            // 5 秒后再次尝试
            this.reconnectTimer = setTimeout(() => this.reconnect(), 5000);
        }
    }

    /**
     * 获取会话列表
     */
    async getConversationList(): Promise<any[]> {
        if (!this.tinode) {
            console.warn('[Tinode] 未初始化，返回空列表');
            return [];
        }

        try {
            const me = this.me || this.tinode.getMeTopic();
            const list: any[] = [];
            // me.contacts requires a callback (tinode-sdk UMD build).
            me.contacts((topic: any) => {
                list.push(topic);
            });

            // 按最后活跃时间倒序
            list.sort((a: any, b: any) => {
                const aTime = a?.touched ? new Date(a.touched).getTime() : 0;
                const bTime = b?.touched ? new Date(b.touched).getTime() : 0;
                return bTime - aTime;
            });

            console.log('[Tinode] 会话列表:', list.length);
            return list;
        } catch (error) {
            console.error('[Tinode] 获取会话列表失败:', error);
            return [];
        }
    }

    /**
     * Best-effort prefetch of latest message for a topic.
     * Useful for conversation list preview after app restart.
     */
    async prefetchLastMessage(topicName: string, limit = 1): Promise<void> {
        if (!this.tinode) return;

        const key = `${topicName}:${limit}`;
        const existing = this.prefetchInFlight.get(key);
        if (existing) return existing;

        const p = (async () => {
            try {
                const topic = this.tinode?.getTopic(topicName);
                if (!topic || typeof topic?.startMetaQuery !== 'function') return;

                const getParams = topic.startMetaQuery().withData(undefined, undefined, limit).build();

                // Need to attach to fetch meta{data}.
                if (!topic?.isSubscribed?.()) {
                    await topic.subscribe();
                    await topic.getMeta(getParams);
                    topic.leaveDelayed?.(false, 500);
                } else {
                    await topic.getMeta(getParams);
                }

                // Allow Tinode to route data into the message cache.
                await new Promise((resolve) => setTimeout(resolve, 0));
            } catch {
                // Best-effort only.
            }
        })();

        this.prefetchInFlight.set(key, p);
        try {
            await p;
        } finally {
            this.prefetchInFlight.delete(key);
        }
    }

    /**
     * 订阅会话（进入聊天室）
     */
    async subscribeToConversation(topicName: string, limit = 50) {
        if (!this.tinode) throw new Error('Tinode not initialized');

        console.log('[Tinode] 订阅会话:', topicName, 'limit:', limit);

        const topic = this.tinode.getTopic(topicName);
        console.log('[Tinode] Topic object:', topic ? 'exists' : 'null');

        // 订阅 + 拉取历史消息
        const getParams = topic.startMetaQuery().withData(undefined, undefined, limit).build();

        let done!: (count: number) => void;
        const waitAll = new Promise<number>((resolve) => {
            done = resolve;
        });

        let receivedCount = -1;

        const prev = topic.onAllMessagesReceived;
        topic.onAllMessagesReceived = (count: number) => {
            receivedCount = count;
            console.log('[Tinode] onAllMessagesReceived callback, count:', count);
            if (typeof prev === 'function') prev(count);
            done(count);
        };

        try {
            const attached = typeof topic?.isSubscribed === 'function' ? topic.isSubscribed() : false;
            console.log('[Tinode] Topic already subscribed?', attached);

            // If the topic is already attached, `topic.subscribe(getParams)` is a no-op
            // (it resolves immediately and does not fetch meta{data}). Always use getMeta.
            if (!attached) {
                console.log('[Tinode] Subscribing to topic...');
                await topic.subscribe();
                console.log('[Tinode] Subscribe complete');
            }
            
            console.log('[Tinode] Fetching meta with limit:', limit);
            await topic.getMeta(getParams);
            console.log('[Tinode] getMeta complete');

            console.log('[Tinode] Waiting for messages (max 8s)...');
            await Promise.race([
                waitAll,
                // Best-effort: do not block the UI forever.
                new Promise((resolve) => setTimeout(() => {
                    console.log('[Tinode] 8s timeout reached');
                    resolve(0);
                }, 8000)),
            ]);

            console.log('[Tinode] Wait complete, receivedCount:', receivedCount);

            // Tinode routes `{data}` and the trailing ctrl ack using `setTimeout(..., 0)`.
            // Give it one tick to ensure messages are inserted into the topic cache
            // before callers enumerate `topic.messages()`.
            await new Promise((resolve) => setTimeout(resolve, 0));

            // Extra safety: in some environments, ctrl ack may be processed slightly ahead
            // of data packet routing. If server reported data but cache is still empty, wait one more tick.
            const messageCount = typeof topic?.messageCount === 'function' ? topic.messageCount() : 0;
            console.log('[Tinode] Topic message count:', messageCount, 'receivedCount:', receivedCount);
            
            if (receivedCount > 0 && messageCount === 0) {
                console.log('[Tinode] Waiting one more tick for messages to populate...');
                await new Promise((resolve) => setTimeout(resolve, 0));
                const finalCount = typeof topic?.messageCount === 'function' ? topic.messageCount() : 0;
                console.log('[Tinode] Final message count:', finalCount);
            }
        } finally {
            // Avoid leaking our temporary handler.
            topic.onAllMessagesReceived = prev;
        }

        console.log('[Tinode] subscribeToConversation complete, returning topic');
        return topic;
    }

	/**
	 * Resolve app user identifier (internal id or publicId) to Tinode user topic id (`usr...`).
	 */
	async resolveTinodeUserId(appUserIdentifier: number | string): Promise<string> {
		const key = String(appUserIdentifier).trim();
		if (!key) {
			throw new Error('Missing user identifier');
		}

		const cached = this.userIdCache.get(key);
		if (cached) return cached;

		const res: any = await tinodeApi.getTinodeUserId(key);
		const tinodeUserId = res?.data?.tinodeUserId;
		if (!tinodeUserId) {
			throw new Error('Failed to resolve Tinode user id');
		}
		this.userIdCache.set(key, tinodeUserId);
		return tinodeUserId;
	}

    /**
     * 发送文本消息
     */
    async sendTextMessage(topicName: string, text: string): Promise<void> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const topic = this.tinode.getTopic(topicName);
        if (!topic?.isSubscribed?.()) {
            await topic.subscribe();
        }
        // Avoid server echo to prevent double-delivery in some setups.
        await topic.publish(text, true);

        console.log('[Tinode] 消息已发送:', text.substring(0, 20));
    }

    /**
     * 发送图片消息
     */
    async sendImageMessage(topicName: string, imageUri: string): Promise<void> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const topic = this.tinode.getTopic(topicName);
        if (!topic?.isSubscribed?.()) {
            await topic.subscribe();
        }

        // 1. 上传图片
        const uploadResult = await this.uploadFile(imageUri, 'image/jpeg');

        // 2. 发送图片消息（使用 Drafty 格式）
        const txt = '[图片]';
        await topic.publish(
            {
                // Keep a readable fallback for clients which don't render images.
                txt,
                // Link entity to text so Tinode treats it as an attachment.
                fmt: [{ at: 0, len: txt.length, tp: 'IM', key: 0 }],
                ent: [
                    {
                        tp: 'IM',
                        data: {
                            mime: 'image/jpeg',
                            val: uploadResult.url,
                            width: uploadResult.width,
                            height: uploadResult.height,
                        },
                    },
                ],
            },
            true
        );

        console.log('[Tinode] 图片已发送:', uploadResult.url);
    }

    async sendFileMessage(
        topicName: string,
        fileUri: string,
        fileName: string,
        mimeType: string,
        fileSize?: number
    ): Promise<void> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const isImage = mimeType.startsWith('image/');
        const maxNonImageBytes = 10 * 1024 * 1024;

        let size: number | undefined;
        const isValidProvidedSize = typeof fileSize === 'number' && Number.isFinite(fileSize) && fileSize > 0;
        if (isValidProvidedSize) {
            size = Math.floor(fileSize);
        } else {
            // Best-effort: try to stat local file path (strip file:// like uploadFile does).
            try {
                const normalizedUri = fileUri.startsWith('file://') ? fileUri.replace(/^file:\/\//, '') : fileUri;
                const stat = await ReactNativeBlobUtil.fs.stat(normalizedUri);
                const rawSize = (stat as { size?: string | number }).size;
                const n = typeof rawSize === 'string' ? Number(rawSize) : rawSize;
                if (typeof n === 'number' && Number.isFinite(n) && n >= 0) {
                    size = Math.floor(n);
                }
            } catch {
                // Ignore: some URIs (e.g. content://) may not be stat'able.
            }
        }

        // Enforce 10MB cap for non-image attachments.
        if (!isImage && typeof size === 'number' && size > maxNonImageBytes) {
            throw new Error('文件大小不能超过 10MB');
        }

        const topic = this.tinode.getTopic(topicName);
        if (!topic?.isSubscribed?.()) {
            await topic.subscribe();
        }

        const safeFileName = fileName.trim() ? fileName.trim() : '[文件]';

        // 1. 上传文件
        const uploadResult = await this.uploadFile(fileUri, mimeType, safeFileName);

        // 2. 发送文件消息（Drafty 格式）
        await topic.publish(
            {
                txt: safeFileName,
                fmt: [{ at: 0, len: safeFileName.length, tp: 'EX', key: 0 }],
                ent: [
                    {
                        tp: 'EX',
                        data: {
                            mime: mimeType,
                            val: uploadResult.url,
                            name: safeFileName,
                            size: typeof size === 'number' ? size : 0,
                        },
                    },
                ],
            },
            true
        );

        console.log('[Tinode] 文件已发送:', uploadResult.url);
    }

    async sendAudioMessage(
        topicName: string,
        audioPath: string,
        duration: number
    ): Promise<void> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const MAX_FILE_SIZE = 5 * 1024 * 1024;

        const audioMimeTypes: Record<string, string> = {
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
        };

        const normalizedPath = audioPath.startsWith('file://')
            ? audioPath.replace(/^file:\/\//, '')
            : audioPath;

        let fileSize: number;
        try {
            const stat = await ReactNativeBlobUtil.fs.stat(normalizedPath);
            const rawSize = (stat as { size?: string | number }).size;
            fileSize = typeof rawSize === 'string' ? Number(rawSize) : (rawSize ?? 0);
        } catch (err) {
            console.error('[Tinode] Failed to stat audio file:', err);
            throw new Error('无法读取语音文件');
        }

        if (fileSize > MAX_FILE_SIZE) {
            throw new Error('语音文件不能超过5MB');
        }

        const fileName = normalizedPath.split('/').pop() || 'audio.m4a';
        const extMatch = fileName.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0].toLowerCase() : '.m4a';
        const mimeType = audioMimeTypes[ext] || 'audio/mp4';

        const topic = this.tinode.getTopic(topicName);
        if (!topic?.isSubscribed?.()) {
            await topic.subscribe();
        }

        const uploadResult = await this.uploadFile(audioPath, mimeType, fileName);

        const content = {
            txt: fileName,
            fmt: [{ at: -1, len: 0, key: 0 }],
            ent: [
                {
                    tp: 'EX',
                    data: {
                        mime: mimeType,
                        val: uploadResult.url,
                        name: fileName,
                        size: fileSize,
                        duration: duration,
                    },
                },
            ],
        };

        await topic.publish(content, true);

        console.log('[Tinode] 语音消息已发送:', uploadResult.url, `时长: ${duration}ms`);
    }

    private async uploadFile(fileUri: string, mimeType: string, fileName?: string): Promise<any> {
        if (!this.tinode) throw new Error('Tinode not initialized');

        const uploadUrl = `${getApiUrl()}/upload`;
        const multipartFileName = fileName || `upload.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;

        // RN fetch/axios may fail for `content://` image URIs with a generic network error.
        // Use react-native-blob-util which can stream files from both file:// and content://.
        const normalizedUri = fileUri.startsWith('file://') ? fileUri.replace(/^file:\/\//, '') : fileUri;

        const token = await SecureStorage.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'multipart/form-data',
        };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        let payload: any;
        try {
            const resp = await ReactNativeBlobUtil.fetch('POST', uploadUrl, headers, [
                {
                    name: 'file',
                    filename: multipartFileName,
                    type: mimeType,
                    data: ReactNativeBlobUtil.wrap(normalizedUri),
                },
            ]);

            const status = resp.info().status;
            payload = resp.json();

            if (status < 200 || status >= 300) {
                throw new Error(payload?.message || `Upload failed (${status})`);
            }
            // Backend may still return {code!=0} with HTTP 200.
            if (payload?.code && payload.code !== 0) {
                throw new Error(payload?.message || 'Upload failed');
            }
        } catch (err) {
            console.error('[Tinode] Upload failed', { uploadUrl, mimeType, fileUri }, err);
            throw err;
        }

        const data = payload?.data ?? payload;

        let imageUrl = data?.url || data?.path;
        if (imageUrl && typeof imageUrl === 'string' && !imageUrl.startsWith('http')) {
            const baseUrl = getApiBaseUrl();
            imageUrl = imageUrl.startsWith('/') ? `${baseUrl}${imageUrl}` : `${baseUrl}/${imageUrl}`;
        }

        return {
            url: imageUrl,
            width: data?.width,
            height: data?.height,
        };
    }

    /**
     * 标记消息已读
     */
    async markAsRead(topicName: string, messageSeqId: number): Promise<void> {
        if (!this.tinode) return;

        const topic = this.tinode.getTopic(topicName);
        await topic.noteRead(messageSeqId);

        console.log('[Tinode] 标记已读:', messageSeqId);
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.connected = false;
        if (this.tinode) {
            this.tinode.disconnect();
            this.tinode = null;
            this.me = null;
            console.log('[Tinode] 已断开连接');
        }

        this.initPromise = null;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * 获取连接状态
     */
    isConnected(): boolean {
        return this.connected;
    }

    getCurrentUserID(): string | null {
        // Tinode internal user id string, like `usrXXXX`.
        return this.tinode?.getCurrentUserID?.() || null;
    }

    /**
     * 获取 Tinode 实例（高级用法）
     */
    getTinode(): any | null {
        return this.tinode;
    }
}

export default TinodeService.getInstance();
