import { Text, View } from '@tarojs/components';
import React, { useMemo } from 'react';

import { getMiniNavMetrics } from '@/utils/navLayout';
import { colors } from '@/theme/tokens';

import { Icon } from './Icon';
import './MiniPageNav.scss';

type MiniPageNavVariant = 'solid' | 'overlay';
export const MINI_PAGE_NAV_EXTRA_BOTTOM = 10;
export const MINI_PAGE_NAV_SOLID_EXTRA_BOTTOM = 18;

interface MiniPageNavProps {
  title: string;
  onBack: () => void;
  variant?: MiniPageNavVariant;
  progress?: number;
  placeholder?: boolean;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const MiniPageNav: React.FC<MiniPageNavProps> = ({
  title,
  onBack,
  variant = 'solid',
  progress = 1,
  placeholder = false,
  showBack = true,
  rightSlot,
}) => {
  const navMetrics = useMemo(() => getMiniNavMetrics(), []);
  const navProgress = variant === 'overlay' ? clamp(progress, 0, 1) : 1;
  const sideInset = Math.max(navMetrics.menuWidth + navMetrics.menuRightInset + 8, 72);
  const extraBottom = useMemo(() => {
    if (variant !== 'overlay') {
      return MINI_PAGE_NAV_SOLID_EXTRA_BOTTOM;
    }

    return MINI_PAGE_NAV_EXTRA_BOTTOM
      + (MINI_PAGE_NAV_SOLID_EXTRA_BOTTOM - MINI_PAGE_NAV_EXTRA_BOTTOM) * navProgress;
  }, [navProgress, variant]);

  const navStyle = useMemo(() => {
    if (variant === 'overlay') {
      return {
        paddingTop: `${navMetrics.menuTop}px`,
        paddingBottom: `${extraBottom}px`,
        minHeight: `${navMetrics.menuBottom}px`,
        backgroundColor: `rgba(255,255,255,${0.96 * navProgress})`,
        borderBottom: navProgress > 0 ? `1rpx solid rgba(229,231,235,${navProgress})` : '1rpx solid transparent',
      };
    }

    return {
      paddingTop: `${navMetrics.menuTop}px`,
      paddingBottom: `${extraBottom}px`,
      minHeight: `${navMetrics.menuBottom}px`,
      background: '#ffffff',
      borderBottom: '1rpx solid #e5e7eb',
    };
  }, [extraBottom, navMetrics.menuBottom, navMetrics.menuTop, navProgress, variant]);

  const titleStyle = useMemo(
    () => ({
      opacity: navProgress,
      color: variant === 'overlay' ? `rgba(17,17,17,${navProgress})` : '#111111',
    }),
    [navProgress, variant],
  );
  const titleSlotStyle = useMemo(
    () => ({
      paddingLeft: `${sideInset}px`,
      paddingRight: `${sideInset}px`,
    }),
    [sideInset],
  );
  const rightSpacerStyle = useMemo(
    () => ({
      width: `${navMetrics.menuWidth}px`,
      marginRight: `${navMetrics.menuRightInset}px`,
      height: `${navMetrics.menuHeight}px`,
    }),
    [navMetrics.menuHeight, navMetrics.menuRightInset, navMetrics.menuWidth],
  );
  const headerMainStyle = useMemo(
    () => ({ height: `${navMetrics.menuHeight}px` }),
    [navMetrics.menuHeight],
  );
  const placeholderStyle = useMemo(
    () => ({ height: `${navMetrics.menuBottom + extraBottom}px` }),
    [extraBottom, navMetrics.menuBottom],
  );
  const lightIconStyle = useMemo(
    () => ({
      opacity: variant === 'overlay' ? 1 - navProgress : 0,
    }),
    [navProgress, variant],
  );
  const darkIconStyle = useMemo(
    () => ({
      opacity: variant === 'overlay' ? navProgress : 1,
    }),
    [navProgress, variant],
  );
  const darkSurfaceStyle = useMemo(
    () => ({
      opacity: variant === 'overlay' ? 1 - navProgress : 0,
    }),
    [navProgress, variant],
  );
  const lightSurfaceStyle = useMemo(
    () => ({
      opacity: variant === 'overlay' ? navProgress : 1,
    }),
    [navProgress, variant],
  );

  return (
    <>
      <View className={`mini-page-nav mini-page-nav--${variant}`} style={navStyle}>
        <View className="mini-page-nav__main" style={headerMainStyle}>
          <View
            className={`mini-page-nav__back-button ${showBack ? '' : 'is-hidden'}`}
            onClick={showBack ? onBack : undefined}
            hoverClass={showBack ? 'mini-page-nav__back-button--pressed' : 'none'}
          >
            <View className="mini-page-nav__back-surface mini-page-nav__back-surface--dark" style={darkSurfaceStyle} />
            <View className="mini-page-nav__back-surface mini-page-nav__back-surface--light" style={lightSurfaceStyle} />
            <View className="mini-page-nav__icon-stack">
              <View className="mini-page-nav__icon-layer" style={lightIconStyle}>
                <Icon name="arrow-left" size={48} color={colors.white} />
              </View>
              <View className="mini-page-nav__icon-layer" style={darkIconStyle}>
                <Icon name="arrow-left" size={48} color={colors.primary} />
              </View>
            </View>
          </View>
          <View className="mini-page-nav__title-slot" style={titleSlotStyle}>
            <Text className="mini-page-nav__title" style={titleStyle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {rightSlot ? <View className="mini-page-nav__right-slot">{rightSlot}</View> : null}
          <View className="mini-page-nav__right-spacer" style={rightSpacerStyle} />
        </View>
      </View>
      {placeholder ? <View className="mini-page-nav__placeholder" style={placeholderStyle} /> : null}
    </>
  );
};

export default MiniPageNav;
