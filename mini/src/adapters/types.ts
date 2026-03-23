import type { RequestOptions } from '@/utils/request';

export interface RequestAdapter {
  request<T>(options: RequestOptions<T>): Promise<T>;
  get<T>(url: string, data?: Record<string, unknown>): Promise<T>;
  post<T>(url: string, data?: unknown): Promise<T>;
  put<T>(url: string, data?: unknown): Promise<T>;
  del<T>(url: string, data?: unknown): Promise<T>;
}

export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export interface UploadAdapter {
  uploadFile(filePath: string, formData?: Record<string, string>): Promise<{
    url: string;
    filename: string;
    size: number;
    type: string;
  }>;
}

export interface IMAdapter {
  init(token: string): Promise<boolean>;
  reconnect(token?: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  getConversationList(): Promise<unknown[]>;
  subscribeToConversation(topicName: string, limit?: number): Promise<unknown>;
  getCachedMessages(topic: unknown): unknown[];
  loadEarlierMessages(topic: unknown, limit?: number): Promise<void>;
  sendTextMessage(topicName: string, text: string): Promise<void>;
  markAsRead(topicName: string, seq?: number): Promise<void>;
  resolveTinodeUserId(appUserIdentifier: number | string): Promise<string>;
  refreshToken(): Promise<{ tinodeToken: string; tinodeError: string }>;
}

export interface NavigationAdapter {
  navigateTo(url: string): Promise<void>;
  redirectTo(url: string): Promise<void>;
  switchTab(url: string): Promise<void>;
  navigateBack(delta?: number): Promise<void>;
  previewImage(urls: string[], current?: string): Promise<void>;
}
