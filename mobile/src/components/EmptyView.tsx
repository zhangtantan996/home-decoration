import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Inbox, Search, FileQuestion } from 'lucide-react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

interface EmptyViewProps {
    type?: 'default' | 'search' | 'data';
    title?: string;
    subtitle?: string;
    actionText?: string;
    onAction?: () => void;
}

const emptyConfig = {
    default: {
        icon: Inbox,
        title: '暂无内容',
        subtitle: '这里空空如也',
    },
    search: {
        icon: Search,
        title: '未找到结果',
        subtitle: '换个关键词试试吧',
    },
    data: {
        icon: FileQuestion,
        title: '暂无数据',
        subtitle: '数据正在准备中',
    },
};

export const EmptyView: React.FC<EmptyViewProps> = ({
    type = 'default',
    title,
    subtitle,
    actionText,
    onAction,
}) => {
    const config = emptyConfig[type];
    const IconComponent = config.icon;

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <IconComponent size={40} color={colors.gray300} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>{title || config.title}</Text>
            <Text style={styles.subtitle}>{subtitle || config.subtitle}</Text>
            {actionText && onAction && (
                <TouchableOpacity style={styles.actionButton} onPress={onAction}>
                    <Text style={styles.actionText}>{actionText}</Text>
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
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.gray50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg - 4,
    },
    title: {
        fontSize: typography.h3,
        fontWeight: '600',
        color: colors.gray700,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.body,
        color: colors.gray400,
        textAlign: 'center',
    },
    actionButton: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.lg - 4,
        paddingVertical: 10,
        borderRadius: spacing.lg - 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionText: {
        fontSize: typography.body,
        color: colors.gray600,
    },
});

export default EmptyView;
