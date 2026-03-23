import Taro from "@tarojs/taro";
import type { SocketTask } from "@tarojs/taro";

type WsEventHandler<T = any> = ((evt: T) => void) | null;

// Tinode SDK expects a browser-like WebSocket interface:
// - `new WebSocketProvider(url)`
// - `onopen/onclose/onerror/onmessage`
// - `send(string)` and `close()`
// We adapt it to `Taro.connectSocket` (weapp).
export default class TaroWebSocketAdapter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = TaroWebSocketAdapter.CONNECTING;
  OPEN = TaroWebSocketAdapter.OPEN;
  CLOSING = TaroWebSocketAdapter.CLOSING;
  CLOSED = TaroWebSocketAdapter.CLOSED;

  readyState: number = TaroWebSocketAdapter.CONNECTING;

  onopen: WsEventHandler = null;
  onclose: WsEventHandler = null;
  onerror: WsEventHandler = null;
  onmessage: WsEventHandler<{ data: any }> = null;

  private task: SocketTask | null = null;
  private connectSeq = 0;

  constructor(url: string) {
    void this.open(url);
  }

  private async open(url: string) {
    const currentSeq = this.connectSeq + 1;
    this.connectSeq = currentSeq;
    const task = await Taro.connectSocket({ url });
    if (
      this.connectSeq !== currentSeq ||
      this.readyState === TaroWebSocketAdapter.CLOSED
    ) {
      task.close({});
      return;
    }

    this.task = task;

    task.onOpen(() => {
      this.readyState = TaroWebSocketAdapter.OPEN;
      this.onopen?.({});
    });

    task.onClose((res) => {
      this.readyState = TaroWebSocketAdapter.CLOSED;
      this.onclose?.(res);
    });

    task.onError((err) => {
      this.onerror?.(err);
    });

    task.onMessage((res) => {
      this.onmessage?.({ data: res.data });
    });
  }

  send(data: string) {
    if (this.readyState !== TaroWebSocketAdapter.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    this.task?.send({ data });
  }

  close() {
    if (this.readyState === TaroWebSocketAdapter.CLOSED) {
      return;
    }

    this.readyState = TaroWebSocketAdapter.CLOSING;
    this.connectSeq += 1;
    this.task?.close({});
  }
}
