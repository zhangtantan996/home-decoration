import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';

interface ImageGridProps {
  images: string[];
  onImagePress: (index: number) => void;
}

// 布局常量：精确计算图片尺寸
const OUTER_MARGIN = 16;
const INNER_PADDING = 16;
const COLUMN_GAP = spacing.sm;

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onImagePress }) => {
  // 使用 useWindowDimensions 支持屏幕旋转和动态尺寸
  const { width } = useWindowDimensions();

  // 精确计算可用宽度：屏幕宽度 - 外边距 - 内边距
  const contentWidth = width - OUTER_MARGIN * 2 - INNER_PADDING * 2;

  // 计算单个图片尺寸：(可用宽度 - 列间距) / 2
  const imageSize = (contentWidth - COLUMN_GAP) / 2;

  // 使用 4:3 的宽高比，更适合展示装修案例图片
  const imageHeight = imageSize * 0.75;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>案例图赏 ({images.length})</Text>
      <View style={styles.grid}>
        {images.map((img, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => onImagePress(idx)}
            activeOpacity={0.9}
            style={[styles.imageWrapper, { width: imageSize, height: imageHeight }]}
          >
            <Image
              source={{ uri: img }}
              style={styles.image}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: spacing.lg + 4,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  imageWrapper: {
    marginBottom: spacing.sm,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray100,
  },
});
