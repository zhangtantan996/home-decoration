import { useSessionStore } from '../modules/session/sessionStore';

export type NotificationRealtimeEvent = {
  type: string;
  timestamp?: number;
  data?: {
    notificationId?: number;
    count?: number;
    connected?: boolean;
    pingIntervalSeconds?: number;
  };
};

type Listener = (event: NotificationRealtimeEvent) => void;

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];
const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const ENABLED = import.meta.env.VITE_ENABLE_NOTIFICATION_WS !== 'false';

const buildRealtimeUrl = (token: string) => {
  const resolvedUrl = new URL(
    /^https?:\/\//.test(API_BASE) ? API_BASE : `${window.location.origin}${API_BASE.startsWith('/') ? '' : '/'}${API_BASE}`,
  );
  resolvedUrl.protocol = resolvedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  resolvedUrl.pathname = `${resolvedUrl.pathname.replace(/\/+$/, '')}/realtime/notifications`;
  resolvedUrl.search = `token=${encodeURIComponent(token)}`;
  return resolvedUrl.toString();
};

class NotificationRealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private closedManually = false;
  private readonly handleOnline = () => {
    if (!this.closedManually) {
      this.connect();
    }
  };
  private readonly handleOffline = () => {
    this.ws?.close();
    this.ws = null;
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
  }

  connect() {
    if (!ENABLED || this.listeners.size === 0) {
      return;
    }
    const token = useSessionStore.getState().accessToken;
    if (!token) {
      this.disconnect();
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.closedManually = false;
    this.ws = new WebSocket(buildRealtimeUrl(token));
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };
    this.ws.onmessage = (event) => this.handleMessage(event.data);
    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    this.closedManually = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.closedManually || !ENABLED || this.listeners.size === 0) {
      return;
    }
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private handleMessage(raw: string) {
    let event: NotificationRealtimeEvent;
    try {
      event = JSON.parse(raw) as NotificationRealtimeEvent;
    } catch {
      return;
    }

    if (event.type === 'ping') {
      this.send({ type: 'pong', timestamp: Date.now() });
      return;
    }

    this.listeners.forEach((listener) => listener(event));
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }
}

export const notificationRealtimeClient = new NotificationRealtimeClient();
