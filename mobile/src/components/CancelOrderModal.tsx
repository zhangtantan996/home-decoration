import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { AlertCircle } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface CancelOrderModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
    visible,
    onClose,
    onConfirm,
    title = '取消订单',
    message = '确定要取消此订单吗？\n取消后将无法恢复，需要重新下单。',
    confirmText = '确认取消',
}) => {
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        console.log('CancelOrderModal: visible prop changed to:', visible);
        if (visible) {
            Animated.timing(animValue, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(animValue, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    if (!visible) return null;

    console.log('CancelOrderModal: rendering modal UI');

    return (
        <View style={styles.modalOverlay}>
            <TouchableOpacity
                style={styles.modalBackdrop}
                activeOpacity={1}
                onPress={() => {
                    console.log('CancelOrderModal: backdrop clicked');
                    onClose();
                }}
            />
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
                <View style={styles.modalIconContainer}>
                    <AlertCircle size={32} color="#EF4444" strokeWidth={2.5} />
                </View>
                <Text style={styles.modalTitle}>{title}</Text>
                <Text style={styles.modalMessage}>{message}</Text>
                <View style={styles.modalActions}>
                    <TouchableOpacity
                        style={styles.modalCancelButton}
                        onPress={() => {
                            console.log('CancelOrderModal: "再想想" button clicked');
                            onClose();
                        }}
                    >
                        <Text style={styles.modalCancelButtonText}>再想想</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.modalConfirmButton}
                        onPress={() => {
                            console.log('CancelOrderModal: "确认取消" button clicked');
                            onConfirm();
                        }}
                    >
                        <Text style={styles.modalConfirmButtonText}>{confirmText}</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        width: width * 0.85,
        backgroundColor: '#FFFFFF',
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
        backgroundColor: '#FEE2E2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#18181B',
        marginBottom: 8,
    },
    modalMessage: {
        fontSize: 15,
        color: '#71717A',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
    },
    modalCancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#52525B',
    },
    modalConfirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        alignItems: 'center',
    },
    modalConfirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default CancelOrderModal;
