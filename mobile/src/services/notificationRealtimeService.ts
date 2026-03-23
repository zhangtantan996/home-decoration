import {
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from 'react-native';
import { ENV } from '../config';
import { SecureStorage } from '../utils/SecureStorage';
// @ts-ignore
import { getApiUrl } from '../config';

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

const buildRealtimeUrl = (token: string) => {
  const apiBaseUrl = String(getApiUrl() || '').replace(/\/+$/, '');
  const resolvedUrl = new URL(apiBaseUrl);
  resolvedUrl.protocol = resolvedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  resolvedUrl.pathname = `${resolvedUrl.pathname.replace(
    /\/+$/,
    '',
  )}/realtime/notifications`;
  resolvedUrl.search = `token=${encodeURIComponent(token)}`;
  return resolvedUrl.toString();
};

type NotificationWebSocketInstance = ReturnType<
  typeof createNotificationWebSocket
>;

const createNotificationWebSocket = (url: string) =>
  new globalThis.WebSocket(url);

class NotificationRealtimeService {
  private ws: NotificationWebSocketInstance | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: NativeEventSubscription | null = null;
  private closedManually = false;

  start() {
    if (!ENV.ENABLE_NOTIFICATION_WS) {
      return;
    }
    if (!this.appStateSubscription) {
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange,
      );
    }
    void this.connect();
  }

  stop() {
    this.closedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    void this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    this.appState = nextAppState;
    if (nextAppState === 'active') {
      this.closedManually = false;
      void this.connect();
      return;
    }

    this.ws?.close();
    this.ws = null;
  };

  private async connect() {
    if (!ENV.ENABLE_NOTIFICATION_WS) {
      return;
    }
    if (this.closedManually || this.appState !== 'active') {
      return;
    }
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const token = await SecureStorage.getToken();
    if (!token) {
      return;
    }

    const websocket = createNotificationWebSocket(buildRealtimeUrl(token));
    websocket.onopen = () => {
      this.reconnectAttempts = 0;
    };
    websocket.onmessage = event => this.handleMessage(String(event.data || ''));
    websocket.onerror = () => {
      websocket.close();
    };
    websocket.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };
    this.ws = websocket;
  }

  private scheduleReconnect() {
    if (
      !ENV.ENABLE_NOTIFICATION_WS ||
      this.closedManually ||
      this.appState !== 'active'
    ) {
      return;
    }
    const delay =
      RECONNECT_DELAYS[
        Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)
      ];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
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

    this.listeners.forEach(listener => listener(event));
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }
}

export const notificationRealtimeService = new NotificationRealtimeService();
