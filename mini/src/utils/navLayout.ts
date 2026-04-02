import { getMiniDeviceProfile, type MiniDevicePlatform, type MiniSizeClass } from './deviceProfile';

const DEFAULT_CAPSULE_GAP = 12;

export interface MiniNavMetrics {
  menuTop: number;
  menuBottom: number;
  menuWidth: number;
  menuHeight: number;
  menuRightInset: number;
  contentTop: number;
  capsuleSafeRight: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  platform: MiniDevicePlatform;
  sizeClass: MiniSizeClass;
}

export const getMiniNavMetrics = (): MiniNavMetrics => {
  const profile = getMiniDeviceProfile();
  const { capsuleRect, safeAreaInsets, windowWidth } = profile;
  const menuTop = capsuleRect.top;
  const menuHeight = capsuleRect.height;
  const menuWidth = capsuleRect.width;
  const menuRightInset = Math.max(windowWidth - capsuleRect.right, safeAreaInsets.right, 10);

  const menuBottom = menuTop + menuHeight;

  return {
    menuTop,
    menuBottom,
    menuWidth,
    menuHeight,
    menuRightInset,
    contentTop: menuBottom + DEFAULT_CAPSULE_GAP,
    capsuleSafeRight: menuRightInset + menuWidth + DEFAULT_CAPSULE_GAP,
    safeAreaTop: safeAreaInsets.top,
    safeAreaBottom: safeAreaInsets.bottom,
    platform: profile.platform,
    sizeClass: profile.sizeClass,
  };
};
