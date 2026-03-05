import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WifiOff, ServerCrash, RefreshCw } from 'lucide-react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

interface NetworkErrorViewProps {
    type?: 'network' | 'server' | 'timeout' | 'unknown';
    message?: string;
    onRetry?: () => void;
}

const errorConfig = {
    network: {
        icon: WifiOff,
        title: '网络连接失败',
        subtitle: '请检查您的网络设置后重试',
    },
    server: {
        icon: ServerCrash,
        title: '服务器开小差了',
        subtitle: '工程师正在紧急修复中',
    },
    timeout: {
        icon: RefreshCw,
        title: '请求超时',
        subtitle: '网络不太给力，请稍后重试',
    },
    unknown: {
        icon: ServerCrash,
        title: '加载失败',
        subtitle: '出了点小问题，请重试',
    },
};

export const NetworkErrorView: React.FC<NetworkErrorViewProps> = ({
    type = 'unknown',
    message,
    onRetry,
}) => {
    const config = errorConfig[type];
    const IconComponent = config.icon;

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <IconComponent size={48} color={colors.gray400} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.subtitle}>{message || config.subtitle}</Text>
            {onRetry && (
                <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
                    <RefreshCw size={16} color={colors.white} />
                    <Text style={styles.retryText}>点击重试</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.gray100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.h2,
        fontWeight: '600',
        color: colors.gray900,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.body,
        color: colors.gray500,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.xl,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.gray900,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: spacing.lg,
        gap: spacing.xs,
    },
    retryText: {
        fontSize: typography.body,
        fontWeight: '600',
        color: colors.white,
    },
});

export default NetworkErrorView;
