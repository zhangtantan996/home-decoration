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
const DISCONNECT_GRACE_MS = 2000;
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
  private wsToken = '';
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private disconnectTimer: number | null = null;
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
    this.clearDisconnectTimer();
    this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.scheduleDisconnect();
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
    this.clearDisconnectTimer();
    if (this.ws && this.wsToken === token && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.ws && this.wsToken !== token) {
      this.disconnect();
    }

    this.closedManually = false;
    this.clearReconnectTimer();

    const ws = new WebSocket(buildRealtimeUrl(token));
    this.ws = ws;
    this.wsToken = token;
    ws.onopen = () => {
      if (this.ws !== ws) {
        return;
      }
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
    };
    ws.onmessage = (event) => {
      if (this.ws !== ws) {
        return;
      }
      this.handleMessage(event.data);
    };
    ws.onclose = () => {
      if (this.ws !== ws) {
        return;
      }
      this.ws = null;
      this.wsToken = '';
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      if (this.ws !== ws) {
        return;
      }
      ws.close();
    };
  }

  disconnect() {
    this.closedManually = true;
    this.clearReconnectTimer();
    this.clearDisconnectTimer();
    const current = this.ws;
    this.ws = null;
    this.wsToken = '';
    current?.close();
  }

  private scheduleDisconnect() {
    this.clearDisconnectTimer();
    this.disconnectTimer = window.setTimeout(() => {
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    }, DISCONNECT_GRACE_MS);
  }

  private scheduleReconnect() {
    if (this.closedManually || !ENABLED || this.listeners.size === 0) {
      return;
    }
    this.clearReconnectTimer();
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer !== null) {
      window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
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
