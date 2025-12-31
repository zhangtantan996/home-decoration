import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';

const PRIMARY_GOLD = '#D4AF37';

interface RejectionReasonModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    loading?: boolean;
}

const RejectionReasonModal: React.FC<RejectionReasonModalProps> = ({
    visible,
    onClose,
    onSubmit,
    loading = false,
}) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        // 验证输入
        if (reason.trim().length < 5) {
            setError('请输入至少5个字符的拒绝原因');
            return;
        }
        if (reason.trim().length > 500) {
            setError('拒绝原因不能超过500个字符');
            return;
        }
        setError('');
        onSubmit(reason.trim());
    };

    const handleClose = () => {
        setReason('');
        setError('');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>拒绝原因</Text>
                            <Text style={styles.subtitle}>
                                请说明拒绝理由，商家可根据您的反馈重新提交方案（最多3次）
                            </Text>
                        </View>

                        {/* Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[styles.textInput, error ? styles.inputError : null]}
                                placeholder="例如：配色不满意，希望调整为现代简约风格"
                                placeholderTextColor="#A1A1AA"
                                multiline
                                numberOfLines={4}
                                maxLength={500}
                                value={reason}
                                onChangeText={(text) => {
                                    setReason(text);
                                    if (error) setError('');
                                }}
                                textAlignVertical="top"
                                autoFocus
                            />
                            <View style={styles.inputFooter}>
                                {error ? (
                                    <Text style={styles.errorText}>{error}</Text>
                                ) : (
                                    <Text style={styles.charCount}>
                                        {reason.length}/500
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={handleClose}
                                disabled={loading}
                            >
                                <Text style={styles.cancelButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
                                onPress={handleSubmit}
                                disabled={loading}
                            >
                                <Text style={styles.submitButtonText}>
                                    {loading ? '提交中...' : '提交'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        maxWidth: 400,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    header: {
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#18181B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#71717A',
        lineHeight: 20,
    },
    inputContainer: {
        marginBottom: 24,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E4E4E7',
        borderRadius: 12,
        padding: 12,
        fontSize: 15,
        color: '#18181B',
        minHeight: 120,
        backgroundColor: '#FAFAFA',
    },
    inputError: {
        borderColor: '#EF4444',
    },
    inputFooter: {
        marginTop: 8,
        alignItems: 'flex-end',
    },
    charCount: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#F4F4F5',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#71717A',
    },
    submitButton: {
        backgroundColor: PRIMARY_GOLD,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});

export default RejectionReasonModal;
