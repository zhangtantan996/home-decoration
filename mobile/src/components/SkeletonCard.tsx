import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, LayoutChangeEvent, ViewStyle, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    style?: ViewStyle;
}

export const SkeletonItem: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius = 4,
    style
}) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, []);

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width: width as any,
                    height: height as any,
                    borderRadius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

export const DesignerSkeletonCard = () => {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <SkeletonItem width={48} height={48} borderRadius={24} />
                <View style={styles.info}>
                    <SkeletonItem width={120} height={20} style={{ marginBottom: 8 }} />
                    <SkeletonItem width={180} height={14} />
                </View>
                <SkeletonItem width={60} height={24} borderRadius={12} />
            </View>
            <View style={styles.body}>
                <View style={styles.tagsRow}>
                    <SkeletonItem width={80} height={16} style={{ marginRight: 8 }} />
                    <SkeletonItem width={150} height={16} />
                </View>
            </View>
            <View style={styles.footer}>
                <SkeletonItem width="100%" height={36} borderRadius={8} />
            </View>
        </View>
    );
};

export const WorkerSkeletonCard = () => {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <SkeletonItem width={48} height={48} borderRadius={24} />
                <View style={styles.info}>
                    <SkeletonItem width={100} height={20} style={{ marginBottom: 8 }} />
                    <SkeletonItem width={160} height={14} />
                </View>
            </View>
            <View style={styles.body}>
                <View style={styles.statsRow}>
                    <SkeletonItem width={80} height={20} style={{ marginRight: 12 }} />
                    <SkeletonItem width={80} height={20} style={{ marginRight: 12 }} />
                    <SkeletonItem width={60} height={20} />
                </View>
                <View style={[styles.tagsRow, { marginTop: 12 }]}>
                    <SkeletonItem width={60} height={22} style={{ marginRight: 8 }} />
                    <SkeletonItem width={60} height={22} style={{ marginRight: 8 }} />
                    <SkeletonItem width={60} height={22} />
                </View>
            </View>
            <View style={styles.footer}>
                <SkeletonItem width="100%" height={32} borderRadius={6} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: '#E4E4E7',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    info: {
        flex: 1,
        marginLeft: 12,
    },
    body: {
        marginBottom: 12,
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footer: {
        marginTop: 0,
    }
});
