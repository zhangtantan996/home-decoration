import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AlertCircle, CheckCircle2, CircleHelp, TriangleAlert } from 'lucide-react-native';

import { SETTINGS_ANIMATION, SETTINGS_COLORS, SETTINGS_RADIUS, SETTINGS_SHADOW } from '../../styles/settingsTheme';

type DialogTone = 'default' | 'success' | 'danger' | 'warning';

interface SettingsDialogProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: DialogTone;
    onConfirm?: () => void;
    onClose: () => void;
}

const getToneColor = (tone: DialogTone) => {
    switch (tone) {
        case 'success':
            return SETTINGS_COLORS.success;
        case 'danger':
            return SETTINGS_COLORS.danger;
        case 'warning':
            return SETTINGS_COLORS.warning;
        default:
            return SETTINGS_COLORS.accent;
    }
};

const getToneIcon = (tone: DialogTone) => {
    switch (tone) {
        case 'success':
            return CheckCircle2;
        case 'danger':
            return AlertCircle;
        case 'warning':
            return TriangleAlert;
        default:
            return CircleHelp;
    }
};

const SettingsDialog: React.FC<SettingsDialogProps> = ({
    visible,
    title,
    message,
    confirmText = '确定',
    cancelText,
    tone = 'default',
    onConfirm,
    onClose,
}) => {
    const [modalVisible, setModalVisible] = useState(visible);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(12)).current;
    const Icon = useMemo(() => getToneIcon(tone), [tone]);
    const toneColor = useMemo(() => getToneColor(tone), [tone]);

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: SETTINGS_ANIMATION.modalIn,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: SETTINGS_ANIMATION.modalIn,
                    useNativeDriver: true,
                }),
            ]).start();
            return;
        }

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: SETTINGS_ANIMATION.modalOut,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 12,
                duration: SETTINGS_ANIMATION.modalOut,
                useNativeDriver: true,
            }),
        ]).start(() => setModalVisible(false));
    }, [visible, opacity, translateY]);

    if (!modalVisible) {
        return null;
    }

    return (
        <Modal transparent visible={modalVisible} animationType="none" statusBarTranslucent>
            <View style={styles.overlay}>
                <Animated.View style={[styles.backdrop, { opacity }]} />
                <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}> 
                    <View style={[styles.iconWrap, { backgroundColor: `${toneColor}14` }]}>
                        <Icon size={26} color={toneColor} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                    <View style={styles.actions}>
                        {cancelText ? (
                            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={onClose}>
                                <Text style={styles.secondaryText}>{cancelText}</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: toneColor }]}
                            activeOpacity={0.88}
                            onPress={() => {
                                if (onConfirm) {
                                    onConfirm();
                                }
                                onClose();
                            }}
                        >
                            <Text style={styles.primaryText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 28,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: SETTINGS_COLORS.overlay,
    },
    container: {
        width: '100%',
        backgroundColor: SETTINGS_COLORS.card,
        borderRadius: SETTINGS_RADIUS.modal,
        padding: 24,
        alignItems: 'center',
        ...SETTINGS_SHADOW,
    },
    iconWrap: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        color: SETTINGS_COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    actions: {
        width: '100%',
        flexDirection: 'row',
        gap: 10,
    },
    secondaryButton: {
        flex: 1,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        borderRadius: SETTINGS_RADIUS.button,
        paddingVertical: 14,
        alignItems: 'center',
    },
    secondaryText: {
        fontSize: 16,
        fontWeight: '600',
        color: SETTINGS_COLORS.textPrimary,
    },
    primaryButton: {
        flex: 1,
        borderRadius: SETTINGS_RADIUS.button,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default SettingsDialog;
