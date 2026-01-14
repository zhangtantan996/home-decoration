import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
    marginTop: 0, // 不使用负margin，避免与Hero视差效果冲突
    transform: [{ translateY: -40 }], // 使用transform实现覆盖效果，支持GPU加速
    zIndex: 2, // 确保卡片在Hero之上
    marginHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
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
    fontSize: 13,
    color: '#999999',
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});
