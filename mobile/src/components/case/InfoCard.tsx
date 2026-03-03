import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography } from '../../theme/tokens';

interface InfoCardProps {
  houseLayout: string;
  area: string;
  style: string;
  year: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({ houseLayout, area, style, year }) => {
  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.label}>户型</Text>
          <Text style={styles.value}>{houseLayout || '暂无'}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>面积</Text>
          <Text style={styles.value}>{area}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>风格</Text>
          <Text style={styles.value}>{style}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.label}>完工</Text>
          <Text style={styles.value}>{year || '-'}年</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 0,
    transform: [{ translateY: -40 }],
    zIndex: 2,
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: spacing.lg + 4,
    padding: spacing.lg - 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: typography.caption,
    color: colors.gray400,
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.black,
  },
});
