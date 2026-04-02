import type { CSSProperties } from 'react';

import { getMiniDeviceProfile } from './deviceProfile';

interface FixedBottomBarStyleOptions {
  paddingX?: number;
  paddingY?: number;
  zIndex?: number;
  backgroundColor?: string;
  borderTopColor?: string;
}

const DEFAULT_FIXED_BAR_PADDING_X = 16;
const DEFAULT_FIXED_BAR_PADDING_Y = 16;
const DEFAULT_FIXED_BAR_HEIGHT = 88;

export const getFixedBottomBarStyle = (
  options: FixedBottomBarStyleOptions = {},
): CSSProperties => {
  const profile = getMiniDeviceProfile();
  const paddingX = options.paddingX ?? DEFAULT_FIXED_BAR_PADDING_X;
  const paddingY = options.paddingY ?? DEFAULT_FIXED_BAR_PADDING_Y;

  return {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: options.zIndex ?? 30,
    boxSizing: 'border-box',
    paddingLeft: `${paddingX}px`,
    paddingRight: `${paddingX}px`,
    paddingTop: `${paddingY}px`,
    paddingBottom: `${paddingY + profile.safeAreaInsets.bottom}px`,
    background: options.backgroundColor ?? 'rgba(255, 255, 255, 0.98)',
    borderTop: `1px solid ${options.borderTopColor ?? 'rgba(17, 17, 17, 0.06)'}`,
  };
};

export const getPageBottomSpacerStyle = (baseHeight = DEFAULT_FIXED_BAR_HEIGHT): CSSProperties => {
  const profile = getMiniDeviceProfile();
  return {
    paddingBottom: `${baseHeight + profile.safeAreaInsets.bottom}px`,
    boxSizing: 'border-box',
  };
};

export const getTabPageBottomSpacerStyle = (baseHeight = 96): CSSProperties => {
  const profile = getMiniDeviceProfile();
  return {
    paddingBottom: `${baseHeight + profile.safeAreaInsets.bottom}px`,
    boxSizing: 'border-box',
  };
};
