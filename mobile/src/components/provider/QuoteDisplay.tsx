import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { ProviderQuoteDisplay } from '../../utils/providerPricing';
import { colors as tokens, radii, spacing, typography } from '../../theme/tokens';

type QuoteDisplayVariant = 'card' | 'compact' | 'detail';

interface QuoteDisplayProps {
  quote: ProviderQuoteDisplay;
  variant?: QuoteDisplayVariant;
  primaryLines?: number;
  secondaryLines?: number;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLES: Record<QuoteDisplayVariant, { primarySize: number; secondarySize: number; padding: number }> = {
  card: {
    primarySize: typography.h3,
    secondarySize: typography.caption,
    padding: spacing.sm,
  },
  compact: {
    primarySize: typography.body,
    secondarySize: typography.caption,
    padding: spacing.xs,
  },
  detail: {
    primarySize: 24,
    secondarySize: typography.body,
    padding: spacing.md,
  },
};

export const QuoteDisplay: React.FC<QuoteDisplayProps> = ({
  quote,
  variant = 'card',
  primaryLines = 1,
  secondaryLines = 2,
  style,
}) => {
  const variantStyle = VARIANT_STYLES[variant];
  const primaryColor = quote.status === 'negotiable' ? tokens.gray700 : tokens.primary;

  return (
    <View style={[styles.container, { padding: variantStyle.padding }, style]}>
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
        {quote.title}
      </Text>
      <Text
        style={[styles.primary, { fontSize: variantStyle.primarySize, color: primaryColor }]}
        numberOfLines={primaryLines}
        ellipsizeMode="tail"
      >
        {quote.primary}
      </Text>
      {quote.secondary ? (
        <Text
          style={[styles.secondary, { fontSize: variantStyle.secondarySize }]}
          numberOfLines={secondaryLines}
          ellipsizeMode="tail"
        >
          {quote.secondary}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.gray50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: tokens.borderSoft,
  },
  title: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: tokens.secondary,
    marginBottom: 6,
  },
  primary: {
    fontWeight: '700',
    lineHeight: 28,
  },
  secondary: {
    color: tokens.gray600,
    lineHeight: 18,
    marginTop: 4,
  },
});

export default QuoteDisplay;
