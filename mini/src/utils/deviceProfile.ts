import Taro from '@tarojs/taro';

export type MiniDevicePlatform = 'ios' | 'android' | 'ohos' | 'devtools' | 'unknown';
export type MiniSizeClass = 'compact' | 'regular';

export interface MiniSafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MiniCapsuleRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface MiniDeviceProfile {
  platform: MiniDevicePlatform;
  isIOS: boolean;
  isAndroid: boolean;
  isHarmony: boolean;
  isDevtools: boolean;
  system: string;
  brand: string;
  model: string;
  windowWidth: number;
  windowHeight: number;
  pixelRatio: number;
  statusBarHeight: number;
  safeAreaInsets: MiniSafeAreaInsets;
  capsuleRect: MiniCapsuleRect;
  sizeClass: MiniSizeClass;
}

const DEFAULT_STATUS_BAR_HEIGHT = 24;
const DEFAULT_WINDOW_WIDTH = 375;
const DEFAULT_WINDOW_HEIGHT = 667;
const DEFAULT_MENU_BUTTON_WIDTH = 96;
const DEFAULT_MENU_BUTTON_HEIGHT = 32;
const DEFAULT_MENU_BUTTON_MARGIN = 8;
const DEFAULT_MENU_BUTTON_RIGHT_INSET = 10;

let cachedProfile: MiniDeviceProfile | null = null;

type MiniGlobal = typeof globalThis & {
  wx?: {
    getDeviceInfo?: () => Partial<Record<'platform' | 'system' | 'brand' | 'model', string>>;
  };
};

const getRawDeviceInfo = () => {
  const runtime = globalThis as MiniGlobal;
  if (runtime.wx && typeof runtime.wx.getDeviceInfo === 'function') {
    return runtime.wx.getDeviceInfo();
  }
  return {};
};

const resolvePlatform = (rawPlatform?: string, system = ''): MiniDevicePlatform => {
  const normalizedPlatform = String(rawPlatform || '').toLowerCase();
  const normalizedSystem = String(system || '');
  const isHarmony = normalizedPlatform === 'ohos'
    || /OpenHarmony/i.test(normalizedSystem)
    || (normalizedPlatform === 'devtools' && /HarmonyOS/i.test(normalizedSystem));

  if (isHarmony) {
    return 'ohos';
  }
  if (normalizedPlatform === 'ios') {
    return 'ios';
  }
  if (normalizedPlatform === 'android') {
    return 'android';
  }
  if (normalizedPlatform === 'devtools') {
    return 'devtools';
  }
  return 'unknown';
};

const resolveSafeAreaInsets = (
  systemInfo: ReturnType<typeof Taro.getSystemInfoSync>,
  statusBarHeight: number,
): MiniSafeAreaInsets => {
  const windowWidth = systemInfo.windowWidth || DEFAULT_WINDOW_WIDTH;
  const referenceHeight = systemInfo.screenHeight || systemInfo.windowHeight || DEFAULT_WINDOW_HEIGHT;
  const safeArea = systemInfo.safeArea;

  if (!safeArea) {
    return {
      top: statusBarHeight,
      right: 0,
      bottom: 0,
      left: 0,
    };
  }

  return {
    top: Math.max(safeArea.top || statusBarHeight, statusBarHeight),
    right: Math.max(windowWidth - (safeArea.right || windowWidth), 0),
    bottom: Math.max(referenceHeight - (safeArea.bottom || referenceHeight), 0),
    left: Math.max(safeArea.left || 0, 0),
  };
};

const resolveCapsuleRect = (
  systemInfo: ReturnType<typeof Taro.getSystemInfoSync>,
  safeAreaInsets: MiniSafeAreaInsets,
): MiniCapsuleRect => {
  const windowWidth = systemInfo.windowWidth || DEFAULT_WINDOW_WIDTH;
  const fallbackTop = safeAreaInsets.top + DEFAULT_MENU_BUTTON_MARGIN;
  const fallbackHeight = DEFAULT_MENU_BUTTON_HEIGHT;
  const fallbackWidth = DEFAULT_MENU_BUTTON_WIDTH;
  const fallbackRight = windowWidth - DEFAULT_MENU_BUTTON_RIGHT_INSET;

  if (typeof Taro.getMenuButtonBoundingClientRect === 'function') {
    const rect = Taro.getMenuButtonBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }
  }

  return {
    top: fallbackTop,
    right: fallbackRight,
    bottom: fallbackTop + fallbackHeight,
    left: fallbackRight - fallbackWidth,
    width: fallbackWidth,
    height: fallbackHeight,
  };
};

export const getMiniDeviceProfile = (): MiniDeviceProfile => {
  if (cachedProfile) {
    return cachedProfile;
  }

  const systemInfo = Taro.getSystemInfoSync();
  const rawDeviceInfo = getRawDeviceInfo();
  const statusBarHeight = systemInfo.statusBarHeight || DEFAULT_STATUS_BAR_HEIGHT;
  const safeAreaInsets = resolveSafeAreaInsets(systemInfo, statusBarHeight);
  const capsuleRect = resolveCapsuleRect(systemInfo, safeAreaInsets);
  const platform = resolvePlatform(
    rawDeviceInfo.platform || systemInfo.platform,
    rawDeviceInfo.system || systemInfo.system,
  );
  const windowWidth = systemInfo.windowWidth || DEFAULT_WINDOW_WIDTH;

  cachedProfile = {
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isHarmony: platform === 'ohos',
    isDevtools: platform === 'devtools',
    system: String(rawDeviceInfo.system || systemInfo.system || ''),
    brand: String(rawDeviceInfo.brand || systemInfo.brand || ''),
    model: String(rawDeviceInfo.model || systemInfo.model || ''),
    windowWidth,
    windowHeight: systemInfo.windowHeight || DEFAULT_WINDOW_HEIGHT,
    pixelRatio: systemInfo.pixelRatio || 2,
    statusBarHeight,
    safeAreaInsets,
    capsuleRect,
    sizeClass: windowWidth >= 768 ? 'regular' : 'compact',
  };

  return cachedProfile;
};

export const resetMiniDeviceProfileCache = () => {
  cachedProfile = null;
};

export const getMiniDeviceLogContext = () => {
  const profile = getMiniDeviceProfile();
  return {
    platform: profile.platform,
    system: profile.system,
    brand: profile.brand,
    model: profile.model,
    windowWidth: profile.windowWidth,
    windowHeight: profile.windowHeight,
    pixelRatio: profile.pixelRatio,
    sizeClass: profile.sizeClass,
  };
};
