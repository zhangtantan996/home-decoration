import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ProviderQuoteDisplay } from '../../utils/providerPricing';
import { colors as tokens, radii, spacing, typography } from '../../theme/tokens';
import QuoteDisplay from './QuoteDisplay';

interface ServiceProviderCardProps {
  imageUri?: string;
  name: string;
  identityLabel: string;
  metaItems: string[];
  descriptor?: string;
  supportingText?: string;
  quote: ProviderQuoteDisplay;
  tags?: string[];
  onPress: () => void;
  compact?: boolean;
}

const joinMetaItems = (items: string[]) => items.filter(Boolean).join(' · ');

export const ServiceProviderCard: React.FC<ServiceProviderCardProps> = ({
  imageUri,
  name,
  identityLabel,
  metaItems,
  descriptor,
  supportingText,
  quote,
  tags = [],
  onPress,
  compact = false,
}) => {
  const visibleTags = compact ? tags.slice(0, 1) : tags.slice(0, 2);
  const imageStyle = compact ? styles.imageCompact : styles.imageRegular;
  const placeholderStyle = compact ? styles.placeholderCompact : styles.placeholderRegular;

  return (
    <TouchableOpacity style={[styles.card, compact && styles.cardCompact]} onPress={onPress} activeOpacity={0.76}>
      <View style={styles.header}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={[styles.image, imageStyle]} />
        ) : (
          <View style={[styles.placeholder, placeholderStyle]}>
            <Text style={styles.placeholderText}>{name.slice(0, 1) || '服'}</Text>
          </View>
        )}
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {name}
            </Text>
            <View style={styles.identityBadge}>
              <Text style={styles.identityText} numberOfLines={1} ellipsizeMode="tail">
                {identityLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
            {joinMetaItems(metaItems)}
          </Text>
          {descriptor ? (
            <Text style={styles.descriptor} numberOfLines={1} ellipsizeMode="tail">
              {descriptor}
            </Text>
          ) : null}
          {supportingText ? (
            <Text style={styles.supporting} numberOfLines={1} ellipsizeMode="tail">
              {supportingText}
            </Text>
          ) : null}
        </View>
      </View>

      <QuoteDisplay
        quote={quote}
        variant={compact ? 'compact' : 'card'}
        primaryLines={1}
        secondaryLines={compact ? 1 : 2}
        style={styles.quoteBlock}
      />

      {visibleTags.length > 0 ? (
        <View style={styles.tagsRow}>
          {visibleTags.map((tag) => (
            <View key={`${identityLabel}-${tag}`} style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1} ellipsizeMode="tail">
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.white,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: tokens.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: tokens.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardCompact: {
    marginHorizontal: 0,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  image: {
    backgroundColor: tokens.gray100,
  },
  imageRegular: {
    width: 68,
    height: 68,
    borderRadius: 18,
  },
  imageCompact: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.gray100,
  },
  placeholderRegular: {
    width: 68,
    height: 68,
    borderRadius: 18,
  },
  placeholderCompact: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  placeholderText: {
    fontSize: typography.h2,
    fontWeight: '700',
    color: tokens.gray500,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.h2,
    fontWeight: '700',
    color: tokens.primary,
  },
  identityBadge: {
    flexShrink: 0,
    maxWidth: 96,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: tokens.gray100,
  },
  identityText: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: tokens.gray700,
  },
  meta: {
    marginTop: 6,
    fontSize: typography.caption,
    color: tokens.secondary,
  },
  descriptor: {
    marginTop: 8,
    fontSize: typography.caption,
    color: tokens.primary,
  },
  supporting: {
    marginTop: 2,
    fontSize: typography.caption,
    color: tokens.gray600,
  },
  quoteBlock: {
    marginTop: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tag: {
    maxWidth: 112,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: tokens.gray100,
  },
  tagText: {
    fontSize: typography.caption,
    color: tokens.gray600,
  },
});

export default ServiceProviderCard;
