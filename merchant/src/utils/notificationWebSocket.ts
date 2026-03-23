import { getApiBaseUrl } from './env';

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

type NotificationWebSocketOptions = {
  url: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onNewNotification?: (notificationId?: number) => void;
  onUnreadCountUpdate?: (count: number) => void;
  onEvent?: (event: NotificationRealtimeEvent) => void;
};

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

export const isNotificationRealtimeEnabled = () => import.meta.env.VITE_ENABLE_NOTIFICATION_WS !== 'false';

export const buildNotificationRealtimeUrl = (token: string) => {
  const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const resolvedUrl = new URL(
    apiBaseUrl.startsWith('http') ? apiBaseUrl : `${window.location.origin}${apiBaseUrl.startsWith('/') ? '' : '/'}${apiBaseUrl}`,
  );
  resolvedUrl.protocol = resolvedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  resolvedUrl.pathname = `${resolvedUrl.pathname.replace(/\/+$/, '')}/realtime/notifications`;
  resolvedUrl.search = `token=${encodeURIComponent(token)}`;
  return resolvedUrl.toString();
};

export class NotificationWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private closedManually = false;
  private readonly options: NotificationWebSocketOptions;
  private readonly handleOnline = () => {
    if (!this.closedManually) {
      this.connect();
    }
  };

  constructor(options: NotificationWebSocketOptions) {
    this.options = options;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }
  }

  connect() {
    if (!isNotificationRealtimeEnabled()) {
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.closedManually = false;
    this.ws = new WebSocket(this.options.url);
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.options.onConnected?.();
    };
    this.ws.onmessage = (event) => this.handleMessage(event.data);
    this.ws.onerror = () => {
      this.options.onDisconnected?.();
    };
    this.ws.onclose = () => {
      this.ws = null;
      this.options.onDisconnected?.();
      this.scheduleReconnect();
    };
  }

  disconnect() {
    this.closedManually = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.closedManually || !isNotificationRealtimeEnabled()) {
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

    this.options.onEvent?.(event);

    if (event.type === 'ping') {
      this.send({ type: 'pong', timestamp: Date.now() });
      return;
    }

    if (event.type === 'notification.new') {
      this.options.onNewNotification?.(event.data?.notificationId);
      return;
    }

    if ((event.type === 'notification.init' || event.type === 'notification.unread_count') && typeof event.data?.count === 'number') {
      this.options.onUnreadCountUpdate?.(event.data.count);
    }
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }
}
