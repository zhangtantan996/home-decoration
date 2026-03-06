import { Tinode } from 'tinode-sdk';

import TaroWebSocketAdapter from './TaroWebSocketAdapter';
import { getTinodeUserId } from './tinode';
import { MINI_ENV } from '@/config/env';

type Listener = (...args: unknown[]) => void;

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

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

const ensureTrailingSlashRemoved = (value: string) => value.replace(/\/+$/, '');

const parseTinodeUrl = (value: string): { host: string; secure: boolean } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return null;
    }
    return {
      host: url.host,
      secure: url.protocol === 'wss:',
    };
  } catch {
    return null;
  }
};

const deriveTinodeUrlFromApiBase = (): { host: string; secure: boolean } | null => {
  const apiBase = MINI_ENV.API_BASE_URL.trim();
  if (!apiBase) return null;

  try {
    const url = new URL(ensureTrailingSlashRemoved(apiBase));
    if (!url.hostname) return null;
    return {
      host: `${url.hostname}:6060`,
      secure: url.protocol === 'https:',
    };
  } catch {
    return null;
  }
};

const getTinodeServerHost = (): { host: string; secure: boolean } => {
  const explicit = parseTinodeUrl(MINI_ENV.TINODE_URL);
  if (explicit) return explicit;

  const derived = deriveTinodeUrlFromApiBase();
  if (derived) return derived;

  return { host: 'localhost:6060', secure: false };
};

// Tinode SDK calls `indexedDB.deleteDatabase()` even with `persist: false`.
// Provide a minimal stub to prevent runtime crashes in weapp.
const stubIndexedDbProvider = {
  deleteDatabase: (_name: string) => {
    const req: any = {};
    setTimeout(() => {
      req.onsuccess?.({});
    }, 0);
    return req;
  },
  open: (_name: string) => {
    const req: any = {};
    setTimeout(() => {
      req.onerror?.({ target: { error: new Error('indexedDB is not supported in weapp') } });
    }, 0);
    return req;
  },
};

class DummyXHR {
  readyState = 0;
  status = 0;
  responseText = '';
  onreadystatechange: ((evt?: any) => void) | null = null;

  open() {
    this.readyState = 1;
  }

  send() {
    throw new Error('XMLHttpRequest is not supported in weapp transport');
  }

  setRequestHeader() {}
  abort() {}
}

let providersConfigured = false;

class TinodeService extends SimpleEventEmitter {
  private static instance: TinodeService;
  private tinode: any | null = null;
  private me: any | null = null;
  private connected = false;
  private initPromise: Promise<boolean> | null = null;
  private currentToken: string | null = null;
  private userIdCache: Map<string, string> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): TinodeService {
    if (!TinodeService.instance) {
      TinodeService.instance = new TinodeService();
    }
    return TinodeService.instance;
  }

  async init(tinodeToken: string): Promise<boolean> {
    if (this.connected && this.tinode && this.me) {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.currentToken = tinodeToken;

    this.initPromise = (async () => {
      try {
        const apiKey = MINI_ENV.TINODE_API_KEY;
        if (!apiKey) {
          console.warn('[Tinode] Missing TARO_APP_TINODE_API_KEY');
          this.connected = false;
          return false;
        }

        if (!providersConfigured) {
          Tinode.setNetworkProviders(TaroWebSocketAdapter as any, DummyXHR as any);
          Tinode.setDatabaseProvider(stubIndexedDbProvider as any);
          providersConfigured = true;
        }

        try {
          this.tinode?.disconnect?.();
        } catch {
          // ignore
        }

        this.connected = false;
        this.tinode = null;
        this.me = null;

        const { host, secure } = getTinodeServerHost();
        console.log('[Tinode] Init', { host, secure });

        this.tinode = new Tinode({
          appName: 'home-decoration-mini',
          host,
          apiKey,
          transport: 'ws',
          secure,
          persist: false,
          platform: 'weapp',
        });

        this.tinode.onConnect = () => {
          this.emit('connected');
        };
        this.tinode.onDisconnect = (err: unknown) => {
          this.connected = false;
          this.emit('disconnected', err);
        };
        this.tinode.onMessage = (msg: unknown) => {
          this.emit('message', msg);
        };

        await this.tinode.connect();
        await this.tinode.loginToken(tinodeToken);

        this.me = this.tinode.getMeTopic();
        this.me.onSubsUpdated = (keys: unknown, count?: unknown) => {
          this.emit('subs-updated', { keys, count });
        };
        this.me.onContactUpdate = (what: unknown, cont: unknown) => {
          this.emit('contact-update', { what, cont });
        };
        this.me.onPres = (pres: unknown) => {
          this.emit('pres', pres);
        };

        const getParams = this.me.startMetaQuery().withDesc().withSub(undefined, 200).build();
        await this.me.subscribe(getParams);

        this.connected = true;
        return true;
      } catch (error) {
        console.error('[Tinode] Init failed', error);
        this.connected = false;
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async reconnect(tinodeToken?: string): Promise<boolean> {
    const token = (tinodeToken || this.currentToken || '').trim();
    if (!token) {
      return false;
    }
    return this.init(token);
  }

  disconnect(): void {
    try {
      this.tinode?.disconnect?.();
    } catch {
      // ignore
    }

    this.connected = false;
    this.tinode = null;
    this.me = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getCurrentUserID(): string | null {
    return this.tinode?.getCurrentUserID?.() || null;
  }

  isMe(uid: string): boolean {
    return !!this.tinode?.isMe?.(uid);
  }

  getTinode(): any | null {
    return this.tinode;
  }

  async getConversationList(): Promise<any[]> {
    if (!this.tinode) return [];

    try {
      const me = this.me || this.tinode.getMeTopic();
      const list: any[] = [];
      me.contacts((topic: any) => {
        list.push(topic);
      });

      list.sort((a: any, b: any) => {
        const aTime = a?.touched ? new Date(a.touched).getTime() : 0;
        const bTime = b?.touched ? new Date(b.touched).getTime() : 0;
        return bTime - aTime;
      });

      return list;
    } catch (error) {
      console.error('[Tinode] getConversationList failed', error);
      return [];
    }
  }

  async subscribeToConversation(topicName: string, limit = 50): Promise<any> {
    if (!this.tinode) {
      throw new Error('Tinode not initialized');
    }

    const topic = this.tinode.getTopic(topicName);
    if (!topic) {
      throw new Error('Invalid topic');
    }

    if (!topic?.isSubscribed?.()) {
      await topic.subscribe();
    }

    const getParams = topic.startMetaQuery().withData(undefined, undefined, limit).build();
    await topic.getMeta(getParams);
    await nextTick();

    return topic;
  }

  getCachedMessages(topic: any): any[] {
    if (!topic) return [];

    const list: any[] = [];
    try {
      topic.messages((msg: any) => list.push(msg));
    } catch (error) {
      console.warn('[Tinode] enumerate messages failed', error);
    }

    return list;
  }

  async loadEarlierMessages(topic: any, limit = 30): Promise<void> {
    if (!topic?.startMetaQuery || !topic?.getMeta) return;
    const getParams = topic.startMetaQuery().withEarlierData(limit).build();
    await topic.getMeta(getParams);
    await nextTick();
  }

  async sendTextMessage(topicName: string, text: string): Promise<void> {
    if (!this.tinode) {
      throw new Error('Tinode not initialized');
    }

    const topic = this.tinode.getTopic(topicName);
    if (!topic?.isSubscribed?.()) {
      await topic.subscribe();
    }

    await topic.publish(text, true);
  }

  async markAsRead(topicName: string, seq?: number): Promise<void> {
    if (!this.tinode) return;

    const topic = this.tinode.getTopic(topicName);
    if (!topic?.isSubscribed?.()) return;

    const nextSeq = typeof seq === 'number' ? seq : topic?.maxMsgSeq?.();
    if (!nextSeq || nextSeq <= 0) return;

    await topic.noteRead(nextSeq);
  }

  async resolveTinodeUserId(appUserIdentifier: number | string): Promise<string> {
    const key = String(appUserIdentifier).trim();
    if (!key) {
      throw new Error('Missing user identifier');
    }

    const cached = this.userIdCache.get(key);
    if (cached) return cached;

    const res = await getTinodeUserId(key);
    const tinodeUserId = (res?.tinodeUserId || '').trim();
    if (!tinodeUserId) {
      throw new Error('Failed to resolve Tinode user id');
    }

    this.userIdCache.set(key, tinodeUserId);
    return tinodeUserId;
  }
}

export default TinodeService.getInstance();

