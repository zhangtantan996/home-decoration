import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Modal,
    Dimensions,
} from 'react-native';

const { width, height } = Dimensions.get('window');

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

// Toast 颜色配置
const TOAST_COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
    info: { bg: '#1A1A1A', text: '#fff', icon: 'ℹ️' },
    success: { bg: '#52C41A', text: '#fff', icon: '✓' },
    warning: { bg: '#FAAD14', text: '#fff', icon: '⚠️' },
    error: { bg: '#FF4D4F', text: '#fff', icon: '✕' },
};

// Toast Provider 组件
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toastVisible, setToastVisible] = useState(false);
    const [toastConfig, setToastConfig] = useState<ToastConfig>({ message: '' });
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({ title: '', message: '' });
    const [agreementVisible, setAgreementVisible] = useState(false);
    const [agreementConfig, setAgreementConfig] = useState<AgreementConfig>({ onAgree: () => { } });

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-100)).current;

    const showToast = useCallback((config: ToastConfig | string) => {
        const normalizedConfig: ToastConfig = typeof config === 'string'
            ? { message: config, type: 'info', duration: 2500 }
            : { type: 'info', duration: 2500, ...config };

        setToastConfig(normalizedConfig);
        setToastVisible(true);

        // 动画显示
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // 自动隐藏
        setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setToastVisible(false);
            });
        }, normalizedConfig.duration);
    }, [fadeAnim, slideAnim]);

    const showConfirm = useCallback((config: ConfirmConfig) => {
        setConfirmConfig({
            confirmText: '确定',
            cancelText: '取消',
            ...config,
        });
        setConfirmVisible(true);
    }, []);

    const showAgreementModal = useCallback((config: AgreementConfig) => {
        setAgreementConfig(config);
        setAgreementVisible(true);
    }, []);

    const handleConfirm = () => {
        setConfirmVisible(false);
        confirmConfig.onConfirm?.();
    };

    const handleCancel = () => {
        setConfirmVisible(false);
        confirmConfig.onCancel?.();
    };

    const handleAgree = () => {
        setAgreementVisible(false);
        agreementConfig.onAgree();
    };

    const handleDisagree = () => {
        setAgreementVisible(false);
        agreementConfig.onDisagree?.();
    };

    const toastColor = TOAST_COLORS[toastConfig.type || 'info'];

    return (
        <ToastContext.Provider value={{ showToast, showConfirm, showAgreementModal }}>
            {children}

            {/* Toast 组件 */}
            {toastVisible && (
                <Animated.View
                    style={[
                        styles.toastContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                            backgroundColor: toastColor.bg,
                        },
                    ]}
                >
                    <Text style={styles.toastIcon}>{toastColor.icon}</Text>
                    <Text style={[styles.toastText, { color: toastColor.text }]}>
                        {toastConfig.message}
                    </Text>
                </Animated.View>
            )}

            {/* Confirm Modal - 居中样式 */}
            <Modal
                visible={confirmVisible}
                transparent
                animationType="fade"
                onRequestClose={handleCancel}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{confirmConfig.title}</Text>
                        <Text style={styles.modalMessage}>{confirmConfig.message}</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={handleCancel}
                            >
                                <Text style={styles.cancelButtonText}>
                                    {confirmConfig.cancelText}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={handleConfirm}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {confirmConfig.confirmText}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Agreement Modal - 底部弹出样式 (仿美团) */}
            <Modal
                visible={agreementVisible}
                transparent
                animationType="slide"
                onRequestClose={handleDisagree}
            >
                <View style={styles.agreementOverlay}>
                    <TouchableOpacity
                        style={styles.agreementBackdrop}
                        activeOpacity={1}
                        onPress={handleDisagree}
                    />
                    <View style={styles.agreementSheet}>
                        <Text style={styles.agreementTitle}>请同意用户协议及隐私保护</Text>
                        <Text style={styles.agreementText}>
                            我已阅读并同意
                            <Text style={styles.agreementLink}>《用户协议》</Text>
                            和
                            <Text style={styles.agreementLink}>《隐私政策》</Text>
                        </Text>
                        <TouchableOpacity
                            style={styles.agreeButton}
                            onPress={handleAgree}
                        >
                            <Text style={styles.agreeButtonText}>同意并继续</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.disagreeButton}
                            onPress={handleDisagree}
                        >
                            <Text style={styles.disagreeButtonText}>不同意</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ToastContext.Provider>
    );
};

// Hook 使用 Toast
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 9999,
    },
    toastIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    toastText: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: width - 60,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 12,
    },
    modalMessage: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
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
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    confirmButton: {
        backgroundColor: '#000',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Agreement Modal Styles (底部弹出)
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
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 40,
    },
    agreementTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
        textAlign: 'center',
        marginBottom: 16,
    },
    agreementText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    agreementLink: {
        color: '#1890FF',
    },
    agreeButton: {
        backgroundColor: '#000',
        paddingVertical: 16,
        borderRadius: 28,
        alignItems: 'center',
        marginBottom: 12,
    },
    agreeButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    disagreeButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    disagreeButtonText: {
        fontSize: 15,
        color: '#999',
    },
});
