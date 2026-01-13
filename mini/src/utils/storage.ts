import Taro from '@tarojs/taro';

export const storage = {
  get<T>(key: string): T | null {
    try {
      const value = Taro.getStorageSync(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      console.warn('storage get error', err);
      return null;
    }
  },
  set<T>(key: string, value: T) {
    try {
      Taro.setStorageSync(key, JSON.stringify(value));
    } catch (err) {
      console.warn('storage set error', err);
    }
  },
  remove(key: string) {
    try {
      Taro.removeStorageSync(key);
    } catch (err) {
      console.warn('storage remove error', err);
    }
  }
};
