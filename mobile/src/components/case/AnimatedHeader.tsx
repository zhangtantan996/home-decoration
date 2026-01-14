import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Platform, StatusBar, Dimensions } from 'react-native';
import { ArrowLeft, Share2 } from 'lucide-react-native';

interface AnimatedHeaderProps {
  scrollY: Animated.Value;
  onBack: () => void;
  onShare: () => void;
}

const { height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.5;
// 动态计算过渡区间，确保在不同屏幕尺寸下都有流畅的过渡效果
const TRANSITION_START = Math.max(0, HERO_HEIGHT - 160);
const TRANSITION_END = Math.max(0, HERO_HEIGHT - 80);

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({ scrollY, onBack, onShare }) => {
  // 动态切换状态栏颜色：白底时使用深色文字，透明时使用浅色文字
  const [barStyle, setBarStyle] = useState<'light-content' | 'dark-content'>('light-content');
  const barStyleRef = useRef<'light-content' | 'dark-content'>('light-content');

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const nextStyle = value >= TRANSITION_END ? 'dark-content' : 'light-content';
      if (barStyleRef.current !== nextStyle) {
        barStyleRef.current = nextStyle;
        setBarStyle(nextStyle);
      }
    });

    return () => scrollY.removeListener(listenerId);
  }, [scrollY]);

  // 使用 opacity 代替 backgroundColor 插值，支持 native driver 以获得更流畅的动画
  const headerBackgroundOpacity = scrollY.interpolate({
    inputRange: [TRANSITION_START, TRANSITION_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // 标题淡入效果，与背景过渡同步
  const titleOpacity = scrollY.interpolate({
    inputRange: [TRANSITION_START + 20, TRANSITION_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={styles.header}>
      {/* 独立的背景层，使用 opacity 动画支持 native driver */}
      <Animated.View
        pointerEvents="none"
        style={[styles.headerBackground, { opacity: headerBackgroundOpacity }]}
      />

      <StatusBar barStyle={barStyle} backgroundColor="transparent" translucent />

      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <ArrowLeft size={24} color="#fff" />
      </TouchableOpacity>

      <Animated.Text style={[styles.headerTitle, { opacity: titleOpacity }]}>
        案例详情
      </Animated.Text>

      <TouchableOpacity onPress={onShare} style={styles.shareBtn}>
        <Share2 size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: STATUSBAR_HEIGHT + 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});
