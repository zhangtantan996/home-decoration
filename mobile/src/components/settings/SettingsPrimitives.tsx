import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    ScrollView,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react-native';

import {
    SETTINGS_COLORS,
    SETTINGS_RADIUS,
    SETTINGS_SHADOW,
    SETTINGS_SPACING,
    SETTINGS_TYPOGRAPHY,
} from '../../styles/settingsTheme';

interface SettingsLayoutProps {
    title: string;
    navigation: any;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

interface SettingsSectionProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

interface SettingsRowProps {
    label: string;
    hint?: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    withChevron?: boolean;
    checked?: boolean;
    last?: boolean;
    disabled?: boolean;
    rightNode?: React.ReactNode;
}

interface SettingsSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
}

interface SettingsActionButtonProps {
    label: string;
    onPress: () => void;
    danger?: boolean;
    secondary?: boolean;
    disabled?: boolean;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ title, navigation, children, footer }) => {
    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={styles.page} edges={['top']}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 4 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <ArrowLeft size={24} color={SETTINGS_COLORS.textPrimary} strokeWidth={2.1} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={styles.backButton} />
            </View>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces
                keyboardShouldPersistTaps="always"
            >
                {children}
                {footer}
            </ScrollView>
        </SafeAreaView>
    );
};

export const SettingsSection: React.FC<SettingsSectionProps> = ({ children, style }) => (
    <View style={[styles.section, style]}>{children}</View>
);

export const SettingsRow: React.FC<SettingsRowProps> = ({
    label,
    hint,
    value,
    onPress,
    danger,
    withChevron = true,
    checked,
    last,
    disabled,
    rightNode,
}) => {
    const content = (
        <View style={[styles.row, last && styles.rowLast, disabled && styles.rowDisabled]}>
            <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, danger && styles.rowDanger]} numberOfLines={1} ellipsizeMode="tail">
                    {label}
                </Text>
                {hint ? (
                    <Text style={styles.rowHint} numberOfLines={2} ellipsizeMode="tail">
                        {hint}
                    </Text>
                ) : null}
            </View>
            <View style={styles.rowRight}>
                {value ? (
                    <Text style={[styles.rowValue, danger && styles.rowDanger]} numberOfLines={1} ellipsizeMode="tail">
                        {value}
                    </Text>
                ) : null}
                {rightNode}
                {checked ? <Check size={18} color={SETTINGS_COLORS.textPrimary} strokeWidth={2.4} /> : null}
                {withChevron ? <ChevronRight size={18} color={SETTINGS_COLORS.textMuted} strokeWidth={2.2} /> : null}
            </View>
        </View>
    );

    if (!onPress || disabled) {
        return content;
    }

    return (
        <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
            {content}
        </TouchableOpacity>
    );
};

export const SettingsSwitch: React.FC<SettingsSwitchProps> = ({ value, onValueChange }) => {
    const translateX = useRef(new Animated.Value(value ? 18 : 0)).current;

    useEffect(() => {
        Animated.timing(translateX, {
            toValue: value ? 18 : 0,
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [translateX, value]);

    const backgroundColor = useMemo(() => (value ? SETTINGS_COLORS.accent : SETTINGS_COLORS.border), [value]);

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={() => onValueChange(!value)}>
            <Animated.View style={[styles.switchTrack, { backgroundColor }]}>
                <Animated.View style={[styles.switchKnob, { transform: [{ translateX }] }]} />
            </Animated.View>
        </TouchableOpacity>
    );
};

export const SettingsActionButton: React.FC<SettingsActionButtonProps> = ({
    label,
    onPress,
    danger,
    secondary,
    disabled,
}) => (
    <TouchableOpacity
        activeOpacity={0.88}
        style={[
            styles.actionButton,
            secondary && styles.actionButtonSecondary,
            danger && styles.actionButtonDanger,
            disabled && styles.actionButtonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
    >
        <Text
            style={[
                styles.actionButtonText,
                secondary && styles.actionButtonTextSecondary,
                danger && styles.actionButtonTextDanger,
                disabled && styles.actionButtonTextDisabled,
            ]}
        >
            {label}
        </Text>
    </TouchableOpacity>
);

export const SettingsFooterLink: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => (
    <TouchableOpacity style={styles.footerLinkWrap} activeOpacity={0.8} onPress={onPress}>
        <Text style={styles.footerLink}>{label}</Text>
    </TouchableOpacity>
);

export const SettingsPageDescription: React.FC<{ text: string }> = () => null;

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: SETTINGS_COLORS.page,
    },
    header: {
        paddingHorizontal: SETTINGS_SPACING.page,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: SETTINGS_TYPOGRAPHY.header,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    scrollContent: {
        paddingHorizontal: SETTINGS_SPACING.page,
        paddingBottom: 44,
        gap: SETTINGS_SPACING.section,
    },
    section: {
        backgroundColor: SETTINGS_COLORS.card,
        borderRadius: SETTINGS_RADIUS.card,
        overflow: 'hidden',
        ...SETTINGS_SHADOW,
    },
    row: {
        minHeight: 68,
        paddingHorizontal: SETTINGS_SPACING.row,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: SETTINGS_COLORS.divider,
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    rowDisabled: {
        opacity: 0.48,
    },
    rowTextWrap: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    rowLabel: {
        fontSize: SETTINGS_TYPOGRAPHY.body,
        fontWeight: '500',
        color: SETTINGS_COLORS.textPrimary,
    },
    rowHint: {
        marginTop: 6,
        fontSize: SETTINGS_TYPOGRAPHY.sub,
        lineHeight: 20,
        color: SETTINGS_COLORS.textSecondary,
    },
    rowValue: {
        flexShrink: 1,
        maxWidth: '100%',
        fontSize: SETTINGS_TYPOGRAPHY.sub,
        color: SETTINGS_COLORS.textSecondary,
        marginRight: 8,
        textAlign: 'right',
    },
    rowRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 1,
        maxWidth: '58%',
        minWidth: 0,
        marginLeft: 12,
        justifyContent: 'flex-end',
    },
    rowDanger: {
        color: SETTINGS_COLORS.danger,
    },
    switchTrack: {
        width: 44,
        height: 26,
        borderRadius: SETTINGS_RADIUS.pill,
        padding: 4,
        justifyContent: 'center',
    },
    switchKnob: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFFFFF',
    },
    actionButton: {
        minHeight: 58,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
    },
    actionButtonSecondary: {
        backgroundColor: SETTINGS_COLORS.card,
        borderWidth: 1,
        borderColor: SETTINGS_COLORS.border,
    },
    actionButtonDanger: {
        backgroundColor: '#FFF5F5',
    },
    actionButtonDisabled: {
        backgroundColor: SETTINGS_COLORS.cardMuted,
        borderColor: SETTINGS_COLORS.divider,
    },
    actionButtonText: {
        fontSize: SETTINGS_TYPOGRAPHY.body,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    actionButtonTextSecondary: {
        color: SETTINGS_COLORS.textPrimary,
    },
    actionButtonTextDanger: {
        color: SETTINGS_COLORS.danger,
    },
    actionButtonTextDisabled: {
        color: SETTINGS_COLORS.textMuted,
    },
    footerLinkWrap: {
        paddingHorizontal: 10,
    },
    footerLink: {
        fontSize: SETTINGS_TYPOGRAPHY.sub,
        color: SETTINGS_COLORS.textLink,
        textAlign: 'center',
    },
});
