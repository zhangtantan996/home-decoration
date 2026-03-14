import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ProviderQuoteDisplay } from '../../utils/providerPricing';
import { colors as tokens, spacing } from '../../theme/tokens';
import QuoteDisplay from './QuoteDisplay';

interface ProviderQuoteSectionProps {
  quote: ProviderQuoteDisplay;
}

export const ProviderQuoteSection: React.FC<ProviderQuoteSectionProps> = ({ quote }) => (
  <View style={styles.container}>
    <QuoteDisplay quote={quote} variant="detail" primaryLines={2} secondaryLines={3} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.borderSoft,
  },
});

export default ProviderQuoteSection;
