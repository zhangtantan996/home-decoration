import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MapPinned, Star } from 'lucide-react-native';
import { Designer } from '../types/provider';

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
    designerCardHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    designerCardBody: {
        marginBottom: 12,
    },
    designerAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F4F4F5',
    },
    designerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    designerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    designerMeta: {
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
    designerOrg: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    orgBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 6,
    },
    personal: { backgroundColor: '#F0F9FF' },
    studio: { backgroundColor: '#F5F3FF' },
    company: { backgroundColor: '#ECFDF5' },
    orgBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#09090B',
    },
    orgName: {
        flex: 1,
        fontSize: 12,
        color: '#71717A',
    },
    designerTagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        // justifyContent: 'space-between', // Removed to control layout better
    },
    priceText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#EF4444',
        marginRight: 12,
    },
    priceUnitText: {
        fontSize: 12,
        fontWeight: '400',
        color: '#71717A',
    },
    distanceInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 4,
    },
    specialtyText: {
        flex: 1,
        fontSize: 12,
        color: '#A1A1AA',
        textAlign: 'right',
    },

});
