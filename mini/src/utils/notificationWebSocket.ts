import Taro from "@tarojs/taro";
import type { SocketTask } from "@tarojs/taro";

import { buildMiniRealtimeUrl, MINI_ENV } from "@/config/env";

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
  token: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onNewNotification?: (notificationId?: number) => void;
  onUnreadCountUpdate?: (count: number) => void;
  onEvent?: (event: NotificationRealtimeEvent) => void;
};

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

export const isNotificationRealtimeEnabled = () =>
  MINI_ENV.ENABLE_NOTIFICATION_WS;

export const buildNotificationRealtimeUrl = (token: string) =>
  buildMiniRealtimeUrl(token);

export class NotificationWebSocket {
  private task: SocketTask | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedManually = false;
  private readyState = 0;
  private connectSeq = 0;
  private readonly options: NotificationWebSocketOptions;

  constructor(options: NotificationWebSocketOptions) {
    this.options = options;
  }

  connect() {
    void this.openConnection();
  }

  private async openConnection() {
    if (!isNotificationRealtimeEnabled() || !this.options.token) {
      return;
    }
    if (this.task && (this.readyState === 0 || this.readyState === 1)) {
      return;
    }

    this.closedManually = false;
    const currentSeq = this.connectSeq + 1;
    this.connectSeq = currentSeq;
    const task = await Taro.connectSocket({
      url: buildNotificationRealtimeUrl(this.options.token),
    });
    if (this.closedManually || this.connectSeq !== currentSeq) {
      task.close({});
      return;
    }
    this.task = task;
    this.readyState = 0;

    task.onOpen(() => {
      if (this.task !== task) {
        return;
      }
      this.readyState = 1;
      this.reconnectAttempts = 0;
      this.options.onConnected?.();
    });

    task.onMessage((result) => {
      if (this.task !== task) {
        return;
      }
      this.handleMessage(String(result.data || ""));
    });

    task.onError(() => {
      if (this.task !== task) {
        return;
      }
      this.readyState = 3;
    });

    task.onClose(() => {
      if (this.task !== task) {
        return;
      }
      this.task = null;
      this.readyState = 3;
      this.options.onDisconnected?.();
      this.scheduleReconnect();
    });
  }

  disconnect() {
    this.closedManually = true;
    this.connectSeq += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.readyState = 2;
    this.task?.close({});
    this.task = null;
  }

  private scheduleReconnect() {
    if (this.closedManually || !isNotificationRealtimeEnabled()) {
      return;
    }
    const delay =
      RECONNECT_DELAYS[
        Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)
      ];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private handleMessage(raw: string) {
    let event: NotificationRealtimeEvent;
    try {
      event = JSON.parse(raw) as NotificationRealtimeEvent;
    } catch {
      return;
    }

    this.options.onEvent?.(event);

    if (event.type === "ping") {
      this.send({ type: "pong", timestamp: Date.now() });
      return;
    }

    if (event.type === "notification.new") {
      this.options.onNewNotification?.(event.data?.notificationId);
      return;
    }

    if (
      (event.type === "notification.init" ||
        event.type === "notification.unread_count") &&
      typeof event.data?.count === "number"
    ) {
      this.options.onUnreadCountUpdate?.(event.data.count);
    }
  }

  private send(payload: Record<string, unknown>) {
    if (!this.task || this.readyState !== 1) {
      return;
    }
    this.task.send({ data: JSON.stringify(payload) });
  }
}
