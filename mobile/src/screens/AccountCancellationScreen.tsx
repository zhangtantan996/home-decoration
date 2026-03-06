import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useToast } from '../components/Toast';
import SettingsDialog from '../components/settings/SettingsDialog';
import { SettingsActionButton, SettingsLayout, SettingsPageDescription, SettingsRow, SettingsSection, SettingsSwitch } from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useAuthStore } from '../store/authStore';

const REASONS = ['暂时不用了', '切换其他账号', '担心隐私与消息打扰', '其他原因'];

const AccountCancellationScreen = ({ navigation }: any) => {
    const { logout } = useAuthStore();
    const { showToast } = useToast();
    const [reason, setReason] = useState(REASONS[0]);
    const [confirmed, setConfirmed] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [dialogVisible, setDialogVisible] = useState(false);

    const submitDisabled = useMemo(() => !confirmed || confirmationText.trim() !== '注销账号', [confirmationText, confirmed]);

    return (
        <SettingsLayout title="注销账号" navigation={navigation}>
            <SettingsPageDescription text="注销流程只保留必要的风险告知和最终确认。满足条件后才允许提交，避免误触发。" />

            <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>注销前请确认</Text>
                <Text style={styles.warningText}>1. 当前账号的登录状态会立即失效。</Text>
                <Text style={styles.warningText}>2. 已提交的反馈草稿和本机缓存会保留在本地，重新登录后仍可查看。</Text>
                <Text style={styles.warningText}>3. 如需恢复账号，请使用相同手机号重新注册或联系平台客服。</Text>
            </View>

            <SettingsSection>
                {REASONS.map((item, index) => (
                    <SettingsRow
                        key={item}
                        label={item}
                        checked={reason === item}
                        onPress={() => setReason(item)}
                        last={index === REASONS.length - 1}
                    />
                ))}
            </SettingsSection>

            <SettingsSection style={styles.formSection}>
                <View style={styles.confirmRow}>
                    <View style={styles.confirmTextWrap}>
                        <Text style={styles.confirmTitle}>我已了解注销影响</Text>
                        <Text style={styles.confirmDesc}>包括登录状态失效、流程重置和后续恢复方式。</Text>
                    </View>
                    <SettingsSwitch value={confirmed} onValueChange={setConfirmed} />
                </View>
                <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>输入“注销账号”确认</Text>
                    <TextInput
                        value={confirmationText}
                        onChangeText={setConfirmationText}
                        placeholder="请输入：注销账号"
                        placeholderTextColor={SETTINGS_COLORS.textMuted}
                        style={styles.input}
                    />
                </View>
            </SettingsSection>

            <SettingsActionButton label="提交注销" onPress={() => setDialogVisible(true)} danger disabled={submitDisabled} />

            <SettingsDialog
                visible={dialogVisible}
                title="确认注销账号"
                message={`注销原因为“${reason}”。确认后将退出当前账号，并回到登录页。`}
                confirmText="确认注销"
                cancelText="取消"
                tone="danger"
                onConfirm={async () => {
                    showToast({ type: 'success', message: '注销流程已提交，当前账号已退出' });
                    await logout();
                }}
                onClose={() => setDialogVisible(false)}
            />
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    warningCard: {
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: '#FFF8F8',
        padding: 18,
        gap: 8,
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: SETTINGS_COLORS.danger,
    },
    warningText: {
        fontSize: 14,
        lineHeight: 21,
        color: SETTINGS_COLORS.textSecondary,
    },
    formSection: {
        padding: 18,
        gap: 18,
    },
    confirmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    confirmTextWrap: {
        flex: 1,
        gap: 4,
    },
    confirmTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    confirmDesc: {
        fontSize: 13,
        lineHeight: 20,
        color: SETTINGS_COLORS.textSecondary,
    },
    fieldWrap: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    input: {
        minHeight: 56,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 16,
        fontSize: 16,
        color: SETTINGS_COLORS.textPrimary,
    },
});

export default AccountCancellationScreen;
