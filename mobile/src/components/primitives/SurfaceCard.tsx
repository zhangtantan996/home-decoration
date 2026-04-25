import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../../theme/tokens';

type SurfaceCardProps = ViewProps & {
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SurfaceCard({ children, padded = true, style, ...viewProps }: SurfaceCardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...viewProps}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  padded: {
    padding: spacing.lg,
  },
});
