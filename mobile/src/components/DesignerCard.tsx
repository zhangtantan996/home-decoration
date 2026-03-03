import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MapPinned, Star } from 'lucide-react-native';
import { Designer } from '../types/provider';
import { colors as tokens, spacing, radii, typography } from '../theme/tokens';

interface DesignerCardProps {
    designer: Designer;
    onPress: (designer: Designer) => void;
    onBookPress: (designer: Designer) => void;
}

export const DesignerCard = memo(({ designer, onPress, onBookPress }: DesignerCardProps) => {
    return (
        <TouchableOpacity
            style={styles.designerCard}
            onPress={() => onPress(designer)}
            activeOpacity={0.7}
        >
            <View style={styles.designerCardHeader}>
                <Image
                    source={{ uri: designer.avatar }}
                    style={styles.designerAvatar}
                />
                <View style={styles.designerInfo}>
                    <Text style={styles.designerName}>{designer.name}</Text>
                    <View style={styles.designerMeta}>
                        <Text style={styles.experienceText}>{designer.yearsExperience}年经验</Text>
                        <Text style={styles.divider}>·</Text>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{designer.rating}</Text>
                    </View>
                    <View style={styles.designerOrg}>
                        <View style={[styles.orgBadge, styles[designer.orgType as keyof typeof styles] as any]}>
                            <Text style={styles.orgBadgeText}>
                                {designer.orgType === 'personal' ? '个人' : designer.orgType === 'studio' ? '工作室' : '公司'}
                            </Text>
                        </View>
                        <Text style={styles.orgName} numberOfLines={1}>{designer.orgLabel}</Text>
                        <View style={styles.distanceInfo}>
                            <MapPinned size={12} color="#71717A" />
                            <Text style={styles.distanceText}>{designer.distance}</Text>
                        </View>
                    </View>
                </View>
            </View>
            <View style={styles.designerCardBody}>
                <View style={styles.designerTagsRow}>
                    <View style={styles.designerTagsRow}>
                        <Text style={styles.priceText}>
                            ¥{designer.priceRange}<Text style={styles.priceUnitText}>{designer.priceUnit}</Text>
                        </Text>
                        <Text style={styles.specialtyText} numberOfLines={1}>{designer.specialty?.replace(/[,，]/g, ' · ')}</Text>
                    </View>
                </View>
            </View>

        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    designerCard: {
        flexDirection: 'column',
        backgroundColor: tokens.white,
        borderRadius: radii.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        marginHorizontal: spacing.md,
        ...Platform.select({
            ios: {
                shadowColor: tokens.black,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    designerCardHeader: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    designerCardBody: {
        marginBottom: spacing.sm,
    },
    designerAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: tokens.bgSecondary,
    },
    designerInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    designerName: {
        fontSize: typography.lg,
        fontWeight: '700',
        color: tokens.primary,
        marginBottom: spacing.xs,
    },
    designerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs + 2,
    },
    experienceText: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    divider: {
        marginHorizontal: spacing.xs,
        color: tokens.border,
    },
    ratingText: {
        fontSize: typography.caption,
        fontWeight: '600',
        color: tokens.primary,
        marginLeft: spacing.xs,
    },
    reviewCountText: {
        fontSize: typography.caption,
        color: tokens.tertiary,
        marginLeft: 2,
    },
    designerOrg: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    orgBadge: {
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 2,
        borderRadius: radii.xs,
        marginRight: spacing.xs + 2,
    },
    personal: { backgroundColor: '#F0F9FF' },
    studio: { backgroundColor: '#F5F3FF' },
    company: { backgroundColor: '#ECFDF5' },
    orgBadgeText: {
        fontSize: typography.xs,
        fontWeight: '600',
        color: tokens.primary,
    },
    orgName: {
        flex: 1,
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    designerTagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        // justifyContent: 'space-between', // Removed to control layout better
    },
    priceText: {
        fontSize: typography.body,
        fontWeight: '700',
        color: tokens.error,
        marginRight: spacing.sm,
    },
    priceUnitText: {
        fontSize: typography.caption,
        fontWeight: '400',
        color: tokens.secondary,
    },
    distanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: typography.caption,
        color: tokens.secondary,
        marginLeft: spacing.xs,
    },
    specialtyText: {
        flex: 1,
        fontSize: typography.caption,
        color: tokens.tertiary,
        textAlign: 'right',
    },

});
