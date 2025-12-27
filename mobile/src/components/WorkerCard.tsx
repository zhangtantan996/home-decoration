import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MapPinned, Star, Users, Briefcase, Award } from 'lucide-react-native';
import { Worker } from '../types/provider';

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
                            <Text style={styles.reviewCountText}>({worker.reviewCount})</Text>
                        </View>
                        <View style={styles.workerWorkType}>
                            <View style={styles.workTypeBadge}>
                                <Text style={styles.workTypeBadgeText}>{worker.workTypeLabels}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                <View style={styles.workerCardBody}>
                    <View style={styles.workerStatsRow}>
                        <Text style={styles.priceInline}>
                            ¥{worker.priceRange}<Text style={styles.priceUnit}>/{worker.priceUnit.replace('元/', '')}</Text>
                        </Text>
                        <Text style={styles.ordersInline}>已完成{worker.completedOrders}单</Text>
                        <View style={styles.distanceInline}>
                            <MapPinned size={12} color="#A1A1AA" />
                            <Text style={styles.distanceInlineText}>{worker.distance}</Text>
                        </View>
                    </View>
                    <View style={styles.workerTags}>
                        {worker.tags.map((tag, idx) => (
                            <View key={idx} style={styles.tagBadge}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={styles.workerCardFooter}>
                    <TouchableOpacity
                        style={styles.bookBtnFull}
                        onPress={() => onBookPress(worker, 'worker')}
                    >
                        <Text style={styles.bookBtnTextSmall}>立即预约</Text>
                    </TouchableOpacity>
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
                        <Text style={styles.reviewCountText}>({worker.reviewCount})</Text>
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
                        <Text style={styles.statValue} numberOfLines={1}>{worker.workTypeLabels}</Text>
                        <Text style={styles.statLabel}>工种</Text>
                    </View>
                </View>
                <View style={styles.companyCerts}>
                    {(worker as any).certifications?.map((cert: string, idx: number) => (
                        <View key={idx} style={styles.certBadge}>
                            <Text style={styles.certBadgeText}>{cert}</Text>
                        </View>
                    ))}
                </View>
                <View style={styles.companyPrice}>
                    <Text style={styles.priceLabel}>参考报价</Text>
                    <Text style={styles.companyPriceValue}>¥{worker.priceRange}{worker.priceUnit}</Text>
                </View>
                <View style={styles.workerTags}>
                    {worker.tags.map((tag, idx) => (
                        <View key={idx} style={styles.tagBadge}>
                            <Text style={styles.tagText}>{tag}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <View style={styles.workerCardFooter}>
                <TouchableOpacity
                    style={styles.bookBtnFull}
                    onPress={() => onBookPress(worker, 'company')}
                >
                    <Text style={styles.bookBtnTextSmall}>立即预约</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    workerCard: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        marginHorizontal: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
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
        marginBottom: 12,
    },
    workerCardBody: {
        marginBottom: 12,
    },
    workerCardFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
        paddingTop: 12,
    },
    workerAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F4F4F5',
    },
    workerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    workerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    workerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    experienceText: {
        fontSize: 12,
        color: '#71717A',
    },
    divider: {
        marginHorizontal: 4,
        color: '#E4E4E7',
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 4,
    },
    reviewCountText: {
        fontSize: 12,
        color: '#A1A1AA',
        marginLeft: 2,
    },
    workerWorkType: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    workTypeBadge: {
        backgroundColor: 'rgba(9, 9, 11, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    workTypeBadgeText: {
        fontSize: 11,
        color: '#09090B',
        fontWeight: '500',
    },
    workerStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priceInline: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    priceUnit: {
        fontSize: 11,
        fontWeight: '400',
        color: '#71717A',
    },
    ordersInline: {
        fontSize: 12,
        color: '#71717A',
    },
    distanceInline: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceInlineText: {
        fontSize: 12,
        color: '#A1A1AA',
        marginLeft: 2,
    },
    workerTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    tagBadge: {
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 6,
        marginBottom: 4,
    },
    tagText: {
        fontSize: 11,
        color: '#71717A',
    },
    bookBtnFull: {
        backgroundColor: '#09090B',
        paddingVertical: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookBtnTextSmall: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    companyCard: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        marginHorizontal: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
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
        marginBottom: 12,
    },
    companyLogo: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
    },
    companyTitle: {
        flex: 1,
        marginLeft: 12,
    },
    companyName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    companyMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    establishedText: {
        fontSize: 12,
        color: '#71717A',
    },
    companyBody: {
        marginBottom: 12,
    },
    companyStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 12,
    },
    companyStatItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#09090B',
        marginVertical: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#71717A',
    },
    companyCerts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
    },
    certBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    certBadgeText: {
        fontSize: 10,
        color: '#059669',
    },
    companyPrice: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    priceLabel: {
        fontSize: 13,
        color: '#71717A',
    },
    companyPriceValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
});
