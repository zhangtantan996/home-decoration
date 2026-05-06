import { Text, View } from '@tarojs/components';
import React, { useMemo } from 'react';

import { getMiniNavMetrics } from '@/utils/navLayout';

import { Icon } from './Icon';
import './MiniPageNav.scss';

type MiniPageNavVariant = 'solid' | 'overlay';
export const MINI_PAGE_NAV_EXTRA_BOTTOM = 10;

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

  const navStyle = useMemo(() => {
    if (variant === 'overlay') {
      return {
        paddingTop: `${navMetrics.menuTop}px`,
        paddingBottom: `${MINI_PAGE_NAV_EXTRA_BOTTOM}px`,
        minHeight: `${navMetrics.menuBottom}px`,
        backgroundColor: `rgba(255,255,255,${0.96 * navProgress})`,
        borderBottom: navProgress > 0 ? `1rpx solid rgba(229,231,235,${navProgress})` : '1rpx solid transparent',
      };
    }

    return {
      paddingTop: `${navMetrics.menuTop}px`,
      paddingBottom: `${MINI_PAGE_NAV_EXTRA_BOTTOM}px`,
      minHeight: `${navMetrics.menuBottom}px`,
      background: '#ffffff',
      borderBottom: '1rpx solid #e5e7eb',
    };
  }, [navMetrics.menuBottom, navMetrics.menuTop, navProgress, variant]);

  const backButtonStyle = useMemo(() => {
    if (variant === 'overlay') {
      return {
        backgroundColor: 'rgba(0,0,0,0.1)',
      };
    }

    return {
      backgroundColor: '#f5f5f5',
    };
  }, [variant]);
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
    () => ({ height: `${navMetrics.menuBottom + MINI_PAGE_NAV_EXTRA_BOTTOM}px` }),
    [navMetrics.menuBottom],
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

  return (
    <>
      <View className={`mini-page-nav mini-page-nav--${variant}`} style={navStyle}>
        <View className="mini-page-nav__main" style={headerMainStyle}>
          <View
            className={`mini-page-nav__back-button ${showBack ? '' : 'is-hidden'}`}
            style={backButtonStyle}
            onClick={showBack ? onBack : undefined}
            hoverClass={showBack ? 'mini-page-nav__back-button--pressed' : 'none'}
          >
            {variant === 'overlay' ? (
              <View className="mini-page-nav__icon-stack">
                <View className="mini-page-nav__icon-layer" style={lightIconStyle}>
                  <Icon name="arrow-left" size={48} color="#FFFFFF" />
                </View>
                <View className="mini-page-nav__icon-layer" style={darkIconStyle}>
                  <Icon name="arrow-left" size={48} color="#111111" />
                </View>
              </View>
            ) : (
              <Icon name="arrow-left" size={48} color="#111111" />
            )}
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
