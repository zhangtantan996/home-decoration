import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useToast } from '../components/Toast';
import SettingsDialog from '../components/settings/SettingsDialog';
import { SettingsActionButton, SettingsLayout, SettingsPageDescription, SettingsSection } from '../components/settings/SettingsPrimitives';
import { authApi, userSettingsApi } from '../services/api';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useAuthStore } from '../store/authStore';

const PHONE_REGEX = /^1[3-9]\d{9}$/;

const ChangePhoneScreen = ({ navigation }: any) => {
    const { user, updateUser } = useAuthStore();
    const { showToast } = useToast();
    const [nextPhone, setNextPhone] = useState('');
    const [smsCode, setSmsCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [successVisible, setSuccessVisible] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!countdown) {
            return;
        }
        const timer = setInterval(() => {
            setCountdown((value) => (value <= 1 ? 0 : value - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const submitDisabled = useMemo(
        () => !PHONE_REGEX.test(nextPhone) || smsCode.length !== 6 || isSubmitting,
        [isSubmitting, nextPhone, smsCode],
    );

    const handleSendCode = async () => {
        if (countdown > 0 || isSending) {
            return;
        }

        if (!PHONE_REGEX.test(nextPhone)) {
            showToast({ type: 'warning', message: '请输入正确的新手机号' });
            return;
        }

        if (nextPhone === user?.phone) {
            showToast({ type: 'warning', message: '新手机号不能与当前手机号相同' });
            return;
        }

        try {
            setIsSending(true);
            await authApi.sendCode(nextPhone, 'change_phone');
            setCountdown(60);
            showToast({ type: 'success', message: '验证码已发送，请注意查收' });
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.response?.data?.message || '发送失败，请稍后重试',
            });
        } finally {
            setIsSending(false);
        }
    };

    const handleSubmit = async () => {
        if (submitDisabled || isSubmitting) {
            return;
        }

        if (nextPhone === user?.phone) {
            showToast({ type: 'warning', message: '新手机号不能与当前手机号相同' });
            return;
        }

        try {
            setIsSubmitting(true);
            await userSettingsApi.changePhone({ newPhone: nextPhone, code: smsCode });
            await updateUser({ phone: nextPhone });
            setSuccessVisible(true);
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.response?.data?.message || '换绑失败，请稍后重试',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SettingsLayout title="修改手机号" navigation={navigation}>
            <SettingsPageDescription text="手机号修改流程已统一到独立页面，和密码、实名认证、设备管理保持相同的跳转节奏。" />

            <SettingsSection style={styles.formSection}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>当前手机号</Text>
                    <Text style={styles.infoValue}>{user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未绑定'}</Text>
                </View>

                <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>新手机号</Text>
                    <TextInput
                        value={nextPhone}
                        onChangeText={setNextPhone}
                        keyboardType="number-pad"
                        placeholder="请输入新手机号"
                        placeholderTextColor={SETTINGS_COLORS.textMuted}
                        style={styles.input}
                        maxLength={11}
                    />
                </View>

                <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>验证码</Text>
                    <View style={styles.codeRow}>
                        <TextInput
                            value={smsCode}
                            onChangeText={setSmsCode}
                            keyboardType="number-pad"
                            placeholder="输入 6 位验证码"
                            placeholderTextColor={SETTINGS_COLORS.textMuted}
                            style={[styles.input, styles.codeInput]}
                            maxLength={6}
                        />
                        <TouchableOpacity
                            activeOpacity={0.88}
                            style={[styles.codeButton, (countdown > 0 || isSending) && styles.codeButtonDisabled]}
                            onPress={handleSendCode}
                            disabled={countdown > 0 || isSending}
                        >
                            <Text style={[styles.codeButtonText, (countdown > 0 || isSending) && styles.codeButtonTextDisabled]}>
                                {countdown > 0 ? `${countdown}s` : isSending ? '发送中...' : '发送验证码'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SettingsSection>

            <SettingsActionButton label={isSubmitting ? '提交中...' : '确认换绑'} onPress={handleSubmit} disabled={submitDisabled} />

            <SettingsDialog
                visible={successVisible}
                title="手机号已更新"
                message="新的手机号已作为当前账号登录方式，下次登录请使用新号码。"
                confirmText="知道了"
                tone="success"
                onClose={() => {
                    setSuccessVisible(false);
                    navigation.goBack();
                }}
            />
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    formSection: {
        padding: 18,
        gap: 16,
    },
    infoCard: {
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        padding: 16,
        gap: 6,
    },
    infoLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: SETTINGS_COLORS.textSecondary,
    },
    infoValue: {
        fontSize: 18,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    fieldWrap: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: SETTINGS_COLORS.textPrimary,
    },
    input: {
        minHeight: 54,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 16,
        fontSize: 16,
        color: SETTINGS_COLORS.textPrimary,
    },
    codeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    codeInput: {
        flex: 1,
    },
    codeButton: {
        minWidth: 110,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    codeButtonDisabled: {
        backgroundColor: SETTINGS_COLORS.divider,
    },
    codeButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    codeButtonTextDisabled: {
        color: SETTINGS_COLORS.textSecondary,
    },
});

export default ChangePhoneScreen;
