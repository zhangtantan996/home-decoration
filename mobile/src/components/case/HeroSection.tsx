import React from 'react';
import { View, Text, ImageBackground, StyleSheet, Dimensions, Animated } from 'react-native';

// 尝试导入 LinearGradient，如果失败则使用降级方案
let LinearGradient: any;
try {
  LinearGradient = require('react-native-linear-gradient').default;
} catch (e) {
  console.warn('LinearGradient not available, using fallback');
  LinearGradient = null;
}

interface HeroSectionProps {
  image: string;
  title: string;
  price: string;
  scrollY: Animated.Value;
}

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.5;

// 创建动画版本的 ImageBackground
const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

export const HeroSection: React.FC<HeroSectionProps> = ({ image, title, price, scrollY }) => {
  // 视差效果: 图片滚动速度为0.5x，只对图片应用transform
  const translateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, HERO_HEIGHT * 0.5],
    extrapolate: 'clamp',
  });

  // 文字淡出效果：滚动到60%时完全消失，避免与顶部标题重叠
  const contentOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.heroContainer}>
      {/* 背景图层：应用视差效果 */}
      <AnimatedImageBackground
        source={{ uri: image }}
        style={[styles.heroImage, { transform: [{ translateY }] }]}
        resizeMode="cover"
      />

      {/* 渐变和文字层：固定在容器内，不随视差移动 */}
      {LinearGradient ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          style={styles.gradient}
        >
          <Animated.View style={[styles.heroContent, { opacity: contentOpacity }]}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroPrice}>
              {price ? `¥${price}` : '暂无报价'}
            </Text>
          </Animated.View>
        </LinearGradient>
      ) : (
        <View style={[styles.gradient, styles.fallbackGradient]}>
          <Animated.View style={[styles.heroContent, { opacity: contentOpacity }]}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroPrice}>
              {price ? `¥${price}` : '暂无报价'}
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: {
    height: HERO_HEIGHT,
    width: width,
    overflow: 'hidden', // 防止视差效果导致内容溢出
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject, // 绝对定位，填充整个容器
  },
  gradient: {
    ...StyleSheet.absoluteFillObject, // 绝对定位，覆盖在图片上
    justifyContent: 'flex-end',
  },
  fallbackGradient: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // 降级方案：使用半透明黑色背景
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FF6B35',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
