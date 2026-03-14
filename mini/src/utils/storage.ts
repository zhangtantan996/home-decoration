import Taro from '@tarojs/taro';

const isH5 = process.env.TARO_ENV === 'h5';

const h5Storage = {
  get(key: string) {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(key);
  },
  set(key: string, value: string) {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, value);
  },
  remove(key: string) {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(key);
  }
};

export const storage = {
  get<T>(key: string): T | null {
    try {
      const value = isH5 ? h5Storage.get(key) : Taro.getStorageSync(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      console.warn('storage get error', err);
      return null;
    }
  },
  set<T>(key: string, value: T) {
    try {
      const payload = JSON.stringify(value);
      if (isH5) {
        h5Storage.set(key, payload);
        return;
      }
      Taro.setStorageSync(key, payload);
    } catch (err) {
      console.warn('storage set error', err);
    }
  },
  remove(key: string) {
    try {
      if (isH5) {
        h5Storage.remove(key);
        return;
      }
      Taro.removeStorageSync(key);
    } catch (err) {
      console.warn('storage remove error', err);
    }
  }
};

// Zustand persist 适配器（供 auth/identity store 使用）
export const taroStorage = {
  getItem: (name: string) => {
    const value = storage.get<string>(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.remove(name)
};
