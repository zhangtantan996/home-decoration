import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MapPinned, Star, Users, Briefcase, Award } from 'lucide-react-native';
import { Worker } from '../types/provider';
import { colors as tokens, spacing, radii, typography } from '../theme/tokens';

interface WorkerCardProps {
    worker: Worker;
    onPress: (worker: Worker) => void;
    onBookPress: (worker: Worker, type: string) => void;
}

export const WorkerCard = memo(({ worker, onPress, onBookPress }: WorkerCardProps) => {
    // 个人师傅卡片
    if (worker.type === 'personal') {
        return (
            <TouchableOpacity
                style={styles.workerCard}
                onPress={() => onPress(worker)}
                activeOpacity={0.7}
            >
                <View style={styles.workerCardHeader}>
                    <Image
                        source={{ uri: worker.avatar }}
                        style={styles.workerAvatar}
                    />
                    <View style={styles.workerInfo}>
                        <Text style={styles.workerName}>{worker.name}</Text>
                        <View style={styles.workerMeta}>
                            <Text style={styles.experienceText}>{worker.yearsExperience}年经验</Text>
                            <Text style={styles.divider}>·</Text>
                            <Star size={12} color="#F59E0B" fill="#F59E0B" />
                            <Text style={styles.ratingText}>{worker.rating}</Text>
                        </View>
                        {/* 服务标签 + 附近 同行显示 */}
                        <View style={styles.workTypeDistanceRow}>
                            {!!worker.serviceLabel && (
                                <View style={styles.workTypeBadge}>
                                    <Text style={styles.workTypeBadgeText}>{worker.serviceLabel}</Text>
                                </View>
                            )}
                            <View style={styles.distanceInline}>
                                <MapPinned size={12} color="#A1A1AA" />
                                <Text style={styles.distanceInlineText}>{worker.distance}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                {/* 价格行 + 认证标签 */}
                <View style={styles.workerPriceRow}>
                    <Text style={styles.priceInlineLarge}>
                        ¥{worker.priceRange}<Text style={styles.priceUnitLarge}>/{worker.priceUnit.replace('元/', '')}</Text>
                    </Text>
                    <View style={styles.certTagsRow}>
                        {worker.tags.slice(0, 2).map((tag, idx) => (
                            <View key={idx} style={styles.tagBadge}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    // 公司卡片
    return (
        <TouchableOpacity
            style={styles.companyCard}
            onPress={() => onPress(worker)}
            activeOpacity={0.7}
        >
            <View style={styles.companyHeader}>
                <Image
                    source={{ uri: (worker as any).logo }}
                    style={styles.companyLogo}
                />
                <View style={styles.companyTitle}>
                    <Text style={styles.companyName}>{worker.name}</Text>
                    <View style={styles.companyMeta}>
                        <Text style={styles.establishedText}>成立{new Date().getFullYear() - (worker as any).establishedYear}年</Text>
                        <Text style={styles.divider}>·</Text>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{worker.rating}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.companyBody}>
                <View style={styles.companyStats}>
                    <View style={styles.companyStatItem}>
                        <Users size={16} color="#71717A" />
                        <Text style={styles.statValue}>{(worker as any).teamSize}人</Text>
                        <Text style={styles.statLabel}>团队</Text>
                    </View>
                    <View style={styles.companyStatItem}>
                        <Briefcase size={16} color="#71717A" />
                        <Text style={styles.statValue}>{worker.completedOrders}</Text>
                        <Text style={styles.statLabel}>已完工</Text>
                    </View>
                    <View style={styles.companyStatItem}>
                        <Award size={16} color="#71717A" />
                        <Text style={styles.statValue} numberOfLines={1}>{worker.serviceLabel}</Text>
                        <Text style={styles.statLabel}>服务</Text>
                    </View>
                </View>
                {/* 资质行 + 认证标签 */}
                <View style={styles.certsRow}>
                    <View style={styles.companyCertsInline}>
                        {(worker as any).certifications?.map((cert: string, idx: number) => (
                            <View key={idx} style={styles.certBadge}>
                                <Text style={styles.certBadgeText}>{cert}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.authTagsRow}>
                        {worker.tags.slice(0, 2).map((tag, idx) => (
                            <View key={idx} style={styles.tagBadge}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    workerCard: {
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
    workerCardHeader: {
        flexDirection: 'row',
        marginBottom: spacing.sm,
    },
    workerCardBody: {
        marginBottom: spacing.sm,
    },
    workerCardFooter: {
        borderTopWidth: 1,
        borderTopColor: tokens.bgSecondary,
        paddingTop: spacing.sm,
    },
    workerAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: tokens.bgSecondary,
    },
    workerInfo: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    workerName: {
        fontSize: typography.lg,
        fontWeight: '700',
        color: tokens.primary,
        marginBottom: spacing.xs,
    },
    workerMeta: {
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
    workerWorkType: {
        flexDirection: 'row',
        marginBottom: spacing.xs,
    },
    workTypeDistanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    workerPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    priceInlineLarge: {
        fontSize: typography.body,
        fontWeight: '700',
        color: tokens.error,
    },
    priceUnitLarge: {
        fontSize: typography.caption,
        fontWeight: '400',
        color: tokens.secondary,
    },
    certTagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    workTypeBadge: {
        backgroundColor: 'rgba(9, 9, 11, 0.05)',
        paddingHorizontal: spacing.xs,
        paddingVertical: 3,
        borderRadius: radii.xs,
    },
    workTypeBadgeText: {
        fontSize: 11,
        color: tokens.primary,
        fontWeight: '500',
    },
    workerStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priceInline: {
        fontSize: typography.lg,
        fontWeight: '700',
        color: tokens.error,
    },
    priceUnit: {
        fontSize: 11,
        fontWeight: '400',
        color: tokens.secondary,
    },
    ordersInline: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    distanceInline: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceInlineText: {
        fontSize: typography.caption,
        color: tokens.tertiary,
        marginLeft: 2,
    },
    workerTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tagBadge: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xs,
        borderRadius: spacing.xs + 2,
        marginRight: spacing.xs + 2,
        marginBottom: spacing.xs,
    },
    tagText: {
        fontSize: 11,
        color: tokens.secondary,
    },
    bookBtnFull: {
        backgroundColor: tokens.primary,
        paddingVertical: 10,
        borderRadius: spacing.xs,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookBtnTextSmall: {
        color: tokens.white,
        fontSize: typography.body,
        fontWeight: '600',
    },
    companyCard: {
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
    companyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    companyLogo: {
        width: 48,
        height: 48,
        borderRadius: spacing.xs,
        backgroundColor: tokens.bgSecondary,
    },
    companyTitle: {
        flex: 1,
        marginLeft: spacing.sm,
    },
    companyName: {
        fontSize: typography.lg,
        fontWeight: '700',
        color: tokens.primary,
        marginBottom: spacing.xs,
    },
    companyMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    establishedText: {
        fontSize: typography.caption,
        color: tokens.secondary,
    },
    companyBody: {
        marginBottom: spacing.sm,
    },
    companyStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
        backgroundColor: '#F8F9FA',
        borderRadius: spacing.xs,
        padding: spacing.sm,
    },
    companyStatItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.body,
        fontWeight: '700',
        color: tokens.primary,
        marginVertical: spacing.xs,
    },
    statLabel: {
        fontSize: 11,
        color: tokens.secondary,
    },
    certsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    companyCertsInline: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1,
    },
    authTagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    companyCerts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: spacing.sm,
    },
    certBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 2,
        borderRadius: radii.xs,
        marginRight: spacing.xs + 2,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    certBadgeText: {
        fontSize: typography.xs,
        color: tokens.success,
    },
    companyPrice: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: tokens.bgSecondary,
    },
    priceLabel: {
        fontSize: 13,
        color: tokens.secondary,
    },
    companyPriceValue: {
        fontSize: typography.lg,
        fontWeight: '700',
        color: tokens.error,
    },
});
