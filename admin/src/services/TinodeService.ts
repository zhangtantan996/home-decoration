import { Tinode } from 'tinode-sdk';

type Listener = (...args: unknown[]) => void;

// Minimal EventEmitter (browser-friendly).
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
    [...set].forEach((fn) => fn(...args));
    return true;
  }
}

const DEFAULT_CONFIG = {
  host: import.meta.env.VITE_TINODE_HOST || 'localhost:6060',
  apiKey: import.meta.env.VITE_TINODE_API_KEY || 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K',
  appName: 'HomeDecoration-Merchant',
};

class TinodeService extends SimpleEventEmitter {
  private static instance: TinodeService;

  private tinode: Tinode | null = null;
  private me: any | null = null;
  private connected = false;
  private initPromise: Promise<boolean> | null = null;
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

  isConnected(): boolean {
    return this.connected;
  }

  getCurrentUserID(): string | null {
    return this.tinode?.getCurrentUserID?.() || null;
  }

  /**
   * Connect + login + subscribe to `me` (loads conversation list metadata).
   */
  async init(tinodeToken: string, config: Partial<typeof DEFAULT_CONFIG> = {}): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    const { host, apiKey, appName } = { ...DEFAULT_CONFIG, ...config };
    console.log('[Tinode] 初始化中...', { host, appName });
    this.initPromise = (async () => {
      try {
        this.tinode = new Tinode({
          appName,
          host,
          apiKey,
          transport: 'ws',
          secure: false,
        }, null);

        this.tinode.onConnect = () => {
          console.log('[Tinode] ✅ WebSocket 已连接');
          this.connected = true;
          this.emit('connected');
        };

        this.tinode.onDisconnect = (err?: unknown) => {
          console.log('[Tinode] ❌ 已断开', err);
          this.connected = false;
          this.emit('disconnected', err);
        };

        this.tinode.onMessage = (msg: unknown) => {
          this.emit('message', msg);
        };

        await this.tinode.connect();
        console.log('[Tinode] connect() 完成');
        await this.tinode.loginToken(tinodeToken);
        console.log('[Tinode] 登录成功', { userId: this.tinode.getCurrentUserID?.() });

        this.me = this.tinode.getMeTopic();

        // IMPORTANT: attach `me` handlers BEFORE subscribing.
        // The initial `me.subscribe({get: ...})` delivers meta (subs) asynchronously; if handlers
        // are attached after subscribe, we may miss the first subs update and the UI won't refresh.
        this.me.onPres = (pres: unknown) => {
          this.emit('pres', pres);
        };

        this.me.onContactUpdate = (what: unknown, cont: unknown) => {
          this.emit('contact-update', { what, cont });
        };

        // Fires after meta{sub} is processed (incl. initial load).
        this.me.onSubsUpdated = (keys: unknown, count?: unknown) => {
          this.emit('subs-updated', { keys, count });
        };

        // Use MetaGetBuilder to request desc+sub properly.
        const getParams = this.me.startMetaQuery().withDesc().withSub(undefined, 200).build();
        await this.me.subscribe(getParams);
        console.log('[Tinode] me topic 订阅成功');

        this.connected = true;
        return true;
      } catch (e) {
        console.error('[Tinode] 初始化失败', e);
        this.connected = false;
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Returns cached P2P conversation topics (topic name is the peer `usr...`).
   */
  async getConversationList(): Promise<any[]> {
    if (!this.me) return [];

    const list: any[] = [];
    // me.contacts requires a callback (tinode-sdk UMD build).
    this.me.contacts((topic: any) => {
      list.push(topic);
    });

    list.sort((a: any, b: any) => {
      const at = a?.touched ? new Date(a.touched).getTime() : 0;
      const bt = b?.touched ? new Date(b.touched).getTime() : 0;
      return bt - at;
    });

    return list;
  }

  /**
   * Subscribe to a conversation topic and fetch last N messages.
   */
  async openConversation(topicName: string, limit = 50): Promise<any> {
    if (!this.tinode) throw new Error('Tinode not initialized');
    const topic = this.tinode.getTopic(topicName);

    const getParams = topic.startMetaQuery().withData(undefined, undefined, limit).build();

    let done!: (count: number) => void;
    const waitAll = new Promise<number>((resolve) => {
      done = resolve;
    });

    let receivedCount = -1;
    const prev = topic.onAllMessagesReceived;
    topic.onAllMessagesReceived = (count: number) => {
      receivedCount = count;
      if (typeof prev === 'function') prev(count);
      done(count);
    };

    try {
      const attached = typeof topic?.isSubscribed === 'function' ? topic.isSubscribed() : false;

      // If the topic is already attached, `subscribe(getParams)` may resolve immediately and
      // not fetch meta{data}. Always use getMeta to fetch messages.
      if (!attached) {
        await topic.subscribe(null);
      }
      await topic.getMeta(getParams);

      // Best-effort: avoid blank UI by not throwing on slow history fetch.
      await Promise.race([
        waitAll,
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);

      // Let SDK route received data into the topic cache.
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (
        receivedCount > 0 &&
        typeof topic?.messageCount === 'function' &&
        topic.messageCount() === 0
      ) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      topic.onAllMessagesReceived = prev;
    }

    return topic;
  }

  /**
   * Enumerate currently cached messages of an opened topic.
   */
  listMessages(topic: any): any[] {
    if (!topic || typeof topic.messages !== 'function') return [];

    const out: any[] = [];
    topic.messages((msg: any) => {
      if (!msg?._deleted && typeof msg.seq === 'number') {
        out.push(msg);
      }
    });
    return out;
  }

  async sendText(topicName: string, text: string): Promise<void> {
    if (!this.tinode) throw new Error('Tinode not initialized');
    const topic = this.tinode.getTopic(topicName);
    if (!topic?.isSubscribed?.()) {
      await topic.subscribe();
    }
    // Avoid server echo to prevent double-delivery in some setups.
    await topic.publish(text, true);
  }

  /**
   * Best-effort prefetch of latest message for a topic.
   * This is useful for conversation list previews when a new message arrives
   * but the topic is not currently subscribed.
   */
  async prefetchLastMessage(topicName: string, limit = 1): Promise<void> {
    if (!this.tinode) return;

    const key = `${topicName}:${limit}`;
    const existing = this.prefetchInFlight.get(key);
    if (existing) return existing;

    const p = (async () => {
      const topic: any = this.tinode?.getTopic(topicName);
      if (!topic) return;

      const getParams = topic.startMetaQuery().withData(undefined, undefined, limit).build();

      try {
        if (!topic.isSubscribed?.()) {
          // Attach briefly, fetch last message, then leave.
          await topic.subscribe(null);
          await topic.getMeta(getParams);
          topic.leaveDelayed?.(false, 500);
        } else {
          await topic.getMeta(getParams);
        }
      } catch {
        // Best-effort only; UI can fallback to "有新消息".
      }
    })();

    this.prefetchInFlight.set(key, p);
    try {
      await p;
    } finally {
      this.prefetchInFlight.delete(key);
    }
  }

  disconnect(): void {
    try {
      this.tinode?.disconnect();
    } finally {
      this.connected = false;
      this.tinode = null;
      this.me = null;
    }
  }
}

export default TinodeService.getInstance();
