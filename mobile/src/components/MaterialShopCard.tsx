import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MapPin, Star, Clock, Store } from 'lucide-react-native';
import { MaterialShop } from '../types/provider';
import { colors as tokens, spacing, radii, typography } from '../theme/tokens';

interface MaterialShopCardProps {
    shop: MaterialShop;
    onPress: (shop: MaterialShop) => void;
}

export const MaterialShopCard = memo(({ shop, onPress }: MaterialShopCardProps) => {
    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => onPress(shop)}
            activeOpacity={0.7}
        >
            <View style={styles.contentContainer}>
                {/* Left: Cover Image */}
                <Image source={{ uri: shop.cover }} style={styles.coverImage} />

                {/* Right: Info */}
                <View style={styles.infoContainer}>
                    <View style={styles.headerRow}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                            {shop.type === 'brand' && shop.brandLogo && (
                                <Image source={{ uri: shop.brandLogo }} style={styles.brandLogo} />
                            )}
                        </View>
                    </View>

                    {/* Rating & Type */}
                    <View style={styles.metaRow}>
                        <View style={[styles.typeBadge, shop.type === 'brand' ? styles.brandBadge : styles.showroomBadge]}>
                            <Text style={[styles.typeText, shop.type === 'brand' ? styles.brandText : styles.showroomText]}>
                                {shop.type === 'brand' ? '品牌店' : '展示店'}
                            </Text>
                        </View>
                        <Text style={styles.divider}>·</Text>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{shop.rating}</Text>
                    </View>

                    {/* Main Products */}
                    <View style={styles.productsRow}>
                        <Text style={styles.productLabel}>主营：</Text>
                        <Text style={styles.productText} numberOfLines={1}>
                            {(shop.mainProducts || []).join(' · ')}
                        </Text>
                    </View>

                    {/* Address & Distance */}
                    <View style={styles.addressRow}>
                        <View style={styles.addressInfo}>
                            <MapPin size={12} color="#71717A" />
                            <Text style={styles.addressText} numberOfLines={1}>{shop.address}</Text>
                        </View>
                        <Text style={styles.distanceText}>{shop.distance}</Text>
                    </View>
                </View>
            </View>

            {/* Footer: Tags & Action */}
            <View style={styles.footer}>
                <View style={styles.tagsContainer}>
                    {(shop.tags || []).map((tag, index) => (
                        <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>
                {/* Optional: Add Call/Book button here if needed */}
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: tokens.white,
        borderRadius: radii.md,
        marginBottom: spacing.sm,
        marginHorizontal: spacing.md,
        padding: spacing.sm,
        ...Platform.select({
            ios: {
                shadowColor: tokens.black,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    contentContainer: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    coverImage: {
        width: 100,
        height: 100,
        borderRadius: spacing.xs,
        backgroundColor: tokens.bgSecondary,
    },
    infoContainer: {
        flex: 1,
        marginLeft: spacing.sm,
        justifyContent: 'space-between',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    shopName: {
        fontSize: typography.lg,
        fontWeight: '600',
        color: tokens.primary,
        marginRight: spacing.xs + 2,
        flexShrink: 1,
    },
    brandLogo: {
        width: 16,
        height: 16,
        borderRadius: radii.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    typeBadge: {
        paddingHorizontal: spacing.xs,
        paddingVertical: 1,
        borderRadius: radii.xs,
    },
    brandBadge: {
        backgroundColor: '#FEF2F2',
    },
    showroomBadge: {
        backgroundColor: '#EFF6FF',
    },
    typeText: {
        fontSize: typography.xs,
        fontWeight: '500',
    },
    brandText: {
        color: tokens.error,
    },
    showroomText: {
        color: tokens.info,
    },
    divider: {
        marginHorizontal: spacing.xs,
        color: tokens.border,
        fontSize: typography.xs,
    },
    ratingText: {
        fontSize: typography.caption,
        fontWeight: '600',
        color: tokens.primary,
        marginLeft: 2,
    },
    reviewCountText: {
        fontSize: typography.caption,
        color: tokens.tertiary,
        marginLeft: 2,
    },
    productsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs + 2,
    },
    productLabel: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    productText: {
        flex: 1,
        fontSize: typography.caption,
        color: tokens.primary,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xs + 2,
    },
    addressInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.xs,
    },
    addressText: {
        fontSize: 11,
        color: tokens.tertiary,
        marginLeft: 2,
        flex: 1,
    },
    distanceText: {
        fontSize: 11,
        color: tokens.secondary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: tokens.bgSecondary,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1,
    },
    tag: {
        backgroundColor: tokens.bgSecondary,
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 2,
        borderRadius: radii.xs,
        marginRight: spacing.xs + 2,
        marginBottom: spacing.xs,
    },
    tagText: {
        fontSize: typography.xs,
        color: tokens.gray600,
    },
});
