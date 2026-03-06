import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react-native';

import SettingsDialog from '../components/settings/SettingsDialog';
import { SettingsActionButton, SettingsLayout, SettingsPageDescription, SettingsSection } from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';

const PasswordField = ({
    label,
    value,
    onChangeText,
    secure,
    onToggle,
    placeholder,
}: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    secure: boolean;
    onToggle: () => void;
    placeholder: string;
}) => (
    <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldInputWrap}>
            <LockKeyhole size={18} color={SETTINGS_COLORS.textMuted} strokeWidth={2.1} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secure}
                placeholder={placeholder}
                placeholderTextColor={SETTINGS_COLORS.textMuted}
                style={styles.fieldInput}
            />
            <TouchableOpacity activeOpacity={0.8} onPress={onToggle}>
                {secure ? (
                    <Eye size={18} color={SETTINGS_COLORS.textMuted} strokeWidth={2.1} />
                ) : (
                    <EyeOff size={18} color={SETTINGS_COLORS.textMuted} strokeWidth={2.1} />
                )}
            </TouchableOpacity>
        </View>
    </View>
);

const ChangePasswordScreen = ({ navigation }: any) => {
    type DialogTone = 'default' | 'warning' | 'success';
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(true);
    const [showNext, setShowNext] = useState(true);
    const [showConfirm, setShowConfirm] = useState(true);
    const [dialogVisible, setDialogVisible] = useState(false);
    const [dialogContent, setDialogContent] = useState<{ title: string; message: string; tone: DialogTone }>({
        title: '',
        message: '',
        tone: 'default',
    });

    const validationMessage = useMemo(() => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            return '请完整填写当前密码、新密码和确认密码。';
        }
        if (newPassword.length < 8) {
            return '新密码至少需要 8 位，建议包含字母与数字。';
        }
        if (newPassword !== confirmPassword) {
            return '两次输入的新密码不一致。';
        }
        if (currentPassword === newPassword) {
            return '新密码需要与当前密码不同。';
        }
        return '';
    }, [confirmPassword, currentPassword, newPassword]);

    const handleSubmit = () => {
        if (validationMessage) {
            setDialogContent({ title: '还差一步', message: validationMessage, tone: 'warning' });
            setDialogVisible(true);
            return;
        }

        setDialogContent({
            title: '密码已更新',
            message: '新的登录密码已生效，下次登录请使用新密码。',
            tone: 'success',
        });
        setDialogVisible(true);
    };

    return (
        <SettingsLayout title="修改登录密码" navigation={navigation}>
            <SettingsPageDescription text="重要操作只保留清晰反馈，不使用系统原生提示框。所有校验会在提交前给出明确说明。" />

            <SettingsSection style={styles.formSection}>
                <PasswordField
                    label="当前密码"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secure={showCurrent}
                    onToggle={() => setShowCurrent((value) => !value)}
                    placeholder="请输入当前密码"
                />
                <PasswordField
                    label="新密码"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secure={showNext}
                    onToggle={() => setShowNext((value) => !value)}
                    placeholder="请输入 8 位以上新密码"
                />
                <PasswordField
                    label="确认新密码"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secure={showConfirm}
                    onToggle={() => setShowConfirm((value) => !value)}
                    placeholder="再次输入新密码"
                />
            </SettingsSection>

            <View style={styles.helperCard}>
                <Text style={styles.helperTitle}>密码建议</Text>
                <Text style={styles.helperText}>使用 8 位以上字母、数字与符号组合，可显著降低被撞库或弱口令攻击的风险。</Text>
            </View>

            <SettingsActionButton label="确认修改" onPress={handleSubmit} />

            <SettingsDialog
                visible={dialogVisible}
                title={dialogContent.title}
                message={dialogContent.message}
                tone={dialogContent.tone}
                onClose={() => {
                    const shouldGoBack = dialogContent.tone === 'success';
                    setDialogVisible(false);
                    if (shouldGoBack) {
                        navigation.goBack();
                    }
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
    fieldWrap: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: SETTINGS_COLORS.textPrimary,
    },
    fieldInputWrap: {
        minHeight: 56,
        borderRadius: SETTINGS_RADIUS.button,
        paddingHorizontal: 16,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    fieldInput: {
        flex: 1,
        fontSize: 16,
        color: SETTINGS_COLORS.textPrimary,
    },
    helperCard: {
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: SETTINGS_COLORS.card,
        padding: 18,
    },
    helperTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
        marginBottom: 8,
    },
    helperText: {
        fontSize: 14,
        lineHeight: 21,
        color: SETTINGS_COLORS.textSecondary,
    },
});

export default ChangePasswordScreen;
