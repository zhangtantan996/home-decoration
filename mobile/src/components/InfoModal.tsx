import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Modal,
    Platform,
} from 'react-native';
import { AlertCircle, CheckCircle, Info } from 'lucide-react-native';
import { colors } from '../theme/tokens';

const { width } = Dimensions.get('window');

type ModalType = 'success' | 'error' | 'info';

interface InfoModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message: string;
    buttonText?: string;
    type?: ModalType;
}

const InfoModal: React.FC<InfoModalProps> = ({
    visible,
    onClose,
    title,
    message,
    buttonText = '知道了',
    type = 'info',
}) => {
    // Internal visibility to keep Modal open during exit animation
    const [modalVisible, setModalVisible] = useState(visible);
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            Animated.timing(animValue, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }).start();
        } else {
            // Animate out then hide Modal
            Animated.timing(animValue, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setModalVisible(false);
            });
        }
    }, [visible]);

    if (!modalVisible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle size={32} color={colors.success} strokeWidth={2.5} />;
            case 'error':
                return <AlertCircle size={32} color={colors.error} strokeWidth={2.5} />;
            default:
                return <Info size={32} color={colors.info} strokeWidth={2.5} />;
        }
    };

    const getIconBgColor = () => {
        switch (type) {
            case 'success':
                return colors.success + '20';
            case 'error':
                return colors.error + '20';
            default:
                return colors.info + '20';
        }
    };

    const getButtonBgColor = () => {
        switch (type) {
            case 'success':
                return colors.success;
            case 'error':
                return colors.error;
            default:
                return colors.primary;
        }
    };

    return (
        <Modal
            transparent
            visible={modalVisible}
            onRequestClose={onClose}
            animationType="none"
            statusBarTranslucent
        >
            <View style={styles.modalOverlay}>
                {/* Backdrop with Fade */}
                <Animated.View
                    style={[
                        styles.modalBackdrop,
                        { opacity: animValue }
                    ]}
                >
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                    />
                </Animated.View>

                {/* Content with Scale & Fade */}
                <Animated.View
                    style={[
                        styles.modalContent,
                        {
                            opacity: animValue,
                            transform: [
                                {
                                    scale: animValue.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.9, 1],
                                    }),
                                },
                                {
                                    translateY: animValue.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [20, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <View style={[styles.modalIconContainer, { backgroundColor: getIconBgColor() }]}>
                        {getIcon()}
                    </View>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <Text style={styles.modalMessage}>{message}</Text>
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: getButtonBgColor() }]}
                            onPress={onClose}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modalButtonText}>{buttonText}</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: width * 0.8,
        backgroundColor: colors.bgCard,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.gray900,
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        color: colors.secondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.white,
    },
});

export default InfoModal;
