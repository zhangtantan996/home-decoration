import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Modal,
    Dimensions,
    Platform,
    Easing,
} from 'react-native';
import { Check, X, Info, AlertTriangle } from 'lucide-react-native';
import { colors, spacing, radii, typography } from '../theme/tokens';

const { width } = Dimensions.get('window');

// Toast 类型
type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastConfig {
    message: string;
    type?: ToastType;
    duration?: number;
}

interface ConfirmConfig {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface AgreementConfig {
    onAgree: () => void;
    onDisagree?: () => void;
}

interface ToastContextType {
    showToast: (config: ToastConfig | string) => void;
    showConfirm: (config: ConfirmConfig) => void;
    showAgreementModal: (config: AgreementConfig) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// 新版设计配置：轻量化、现代感
const TOAST_THEME: Record<ToastType, { bg: string; border: string; iconColor: string; textColor: string }> = {
    info: { bg: colors.white, border: colors.info, iconColor: colors.info, textColor: '#1F2937' },
    success: { bg: colors.white, border: colors.success, iconColor: colors.success, textColor: '#1F2937' },
    warning: { bg: colors.white, border: colors.warning, iconColor: colors.warning, textColor: '#1F2937' },
    error: { bg: colors.white, border: colors.error, iconColor: colors.error, textColor: '#1F2937' },
};

// 图标组件
const ToastIcon: React.FC<{ type: ToastType; color: string }> = ({ type, color }) => {
    const iconProps = { size: 16, color, strokeWidth: 2.5 };
    switch (type) {
        case 'success':
            return <Check {...iconProps} />;
        case 'error':
            return <X {...iconProps} />;
        case 'warning':
            return <AlertTriangle {...iconProps} />;
        case 'info':
        default:
            return <Info {...iconProps} />;
    }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toastVisible, setToastVisible] = useState(false);
    const [toastConfig, setToastConfig] = useState<ToastConfig>({ message: '' });

    // 弹窗相关状态
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({ title: '', message: '' });
    const [agreementVisible, setAgreementVisible] = useState(false);
    const [agreementConfig, setAgreementConfig] = useState<AgreementConfig>({ onAgree: () => { } });

    // 动画值
    const animValue = useRef(new Animated.Value(0)).current;

    // 显示 Toast
    const showToast = useCallback((config: ToastConfig | string) => {
        const normalizedConfig: ToastConfig = typeof config === 'string'
            ? { message: config, type: 'info', duration: 2500 }
            : { type: 'info', duration: 2500, ...config };

        setToastConfig(normalizedConfig);
        setToastVisible(true);

        // 重置动画值
        animValue.setValue(0);

        // 进场动画：Spring 弹簧效果
        Animated.spring(animValue, {
            toValue: 1,
            friction: 6, // 摩擦力，越小越弹
            tension: 50, // 张力
            useNativeDriver: true,
        }).start();

        // 自动隐藏
        const timer = setTimeout(() => {
            hideToast();
        }, normalizedConfig.duration);

        return () => clearTimeout(timer);
    }, [animValue]);

    const hideToast = () => {
        // 出场动画：平滑淡出并位移
        Animated.timing(animValue, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start(() => {
            setToastVisible(false);
        });
    };

    // Confirm & Agreement Handlers (保持原有逻辑)
    const showConfirm = useCallback((config: ConfirmConfig) => {
        setConfirmConfig({ confirmText: '确定', cancelText: '取消', ...config });
        setConfirmVisible(true);
    }, []);

    const showAgreementModal = useCallback((config: AgreementConfig) => {
        setAgreementConfig(config);
        setAgreementVisible(true);
    }, []);

    const handleConfirm = () => { confirmConfig.onConfirm?.(); setConfirmVisible(false); };
    const handleCancel = () => { confirmConfig.onCancel?.(); setConfirmVisible(false); };
    const handleAgree = () => { agreementConfig.onAgree(); setAgreementVisible(false); };
    const handleDisagree = () => { agreementConfig.onDisagree?.(); setAgreementVisible(false); };

    const theme = TOAST_THEME[toastConfig.type || 'info'];

    // 动画插值
    const translateY = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-20, 0], // 从上方 -20px 处下落到 0
    });

    const opacity = animValue.interpolate({
        inputRange: [0, 0.2, 1],
        outputRange: [0, 1, 1],
    });

    const scale = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 1],
    });

    return (
        <ToastContext.Provider value={{ showToast, showConfirm, showAgreementModal }}>
            {children}

            {/* Toast 容器 */}
            {toastVisible && (
                <View style={styles.toastWrapper} pointerEvents="none">
                    <Animated.View
                        style={[
                            styles.toastContainer,
                            {
                                backgroundColor: theme.bg,
                                transform: [{ translateY }, { scale }],
                                opacity,
                                borderLeftColor: theme.border,
                            },
                        ]}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: theme.border + '15' }]}>
                            <ToastIcon type={toastConfig.type || 'info'} color={theme.iconColor} />
                        </View>
                        <Text style={[styles.toastText, { color: theme.textColor }]}>
                            {toastConfig.message}
                        </Text>
                    </Animated.View>
                </View>
            )}

            {/* Confirm Modal */}
            <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={handleCancel}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{confirmConfig.title}</Text>
                        <Text style={styles.modalMessage}>{confirmConfig.message}</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={handleCancel}>
                                <Text style={styles.cancelButtonText}>{confirmConfig.cancelText}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleConfirm}>
                                <Text style={styles.confirmButtonText}>{confirmConfig.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Agreement Modal */}
            <Modal visible={agreementVisible} transparent animationType="slide" onRequestClose={handleDisagree}>
                <View style={styles.agreementOverlay}>
                    <TouchableOpacity style={styles.agreementBackdrop} activeOpacity={1} onPress={handleDisagree} />
                    <View style={styles.agreementSheet}>
                        <Text style={styles.agreementTitle}>请同意用户协议及隐私保护</Text>
                        <Text style={styles.agreementText}>
                            我已阅读并同意<Text style={styles.agreementLink}>《用户协议》</Text>和<Text style={styles.agreementLink}>《隐私政策》</Text>
                        </Text>
                        <TouchableOpacity style={styles.agreeButton} onPress={handleAgree}>
                            <Text style={styles.agreeButtonText}>同意并继续</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.disagreeButton} onPress={handleDisagree}>
                            <Text style={styles.disagreeButtonText}>不同意</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};

const styles = StyleSheet.create({
    toastWrapper: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 90, // 下移到 header 下方
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
    },
    toastContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.full,
        maxWidth: width - 60,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
        borderLeftWidth: 3,
        backgroundColor: colors.white,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.xs,
    },
    toastText: {
        fontSize: typography.caption,
        fontWeight: '600',
        flexShrink: 1,
    },
    // Modal Styles ...
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: width - 60,
        backgroundColor: colors.white,
        borderRadius: radii.lg,
        padding: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.h2,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    modalMessage: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.lg,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F5F5F5',
    },
    cancelButtonText: {
        fontSize: typography.h3,
        fontWeight: '600',
        color: '#666',
    },
    confirmButton: {
        backgroundColor: colors.black,
    },
    confirmButtonText: {
        fontSize: typography.h3,
        fontWeight: '600',
        color: colors.white,
    },
    agreementOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    agreementBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    agreementSheet: {
        backgroundColor: colors.white,
        borderTopLeftRadius: spacing.lg + 4,
        borderTopRightRadius: spacing.lg + 4,
        paddingHorizontal: spacing.lg,
        paddingTop: 28,
        paddingBottom: 40,
    },
    agreementTitle: {
        fontSize: typography.h2,
        fontWeight: '700',
        color: colors.black,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    agreementText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: spacing.lg,
    },
    agreementLink: {
        color: '#1890FF',
    },
    agreeButton: {
        backgroundColor: colors.black,
        paddingVertical: spacing.md,
        borderRadius: 28,
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    agreeButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.white,
    },
    disagreeButton: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    disagreeButtonText: {
        fontSize: 15,
        color: '#999',
    },
});
