import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { BadgeCheck, ImagePlus } from 'lucide-react-native';

import { useToast } from '../components/Toast';
import SettingsDialog from '../components/settings/SettingsDialog';
import { SettingsActionButton, SettingsLayout, SettingsPageDescription, SettingsSection } from '../components/settings/SettingsPrimitives';
import { settingsService } from '../services/settingsService';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';

const resolveStatusText = (status: string) => {
    switch (status) {
        case 'reviewing':
            return '审核中';
        case 'verified':
            return '已认证';
        default:
            return '未认证';
    }
};

const RealNameVerificationScreen = ({ navigation }: any) => {
    const { showToast } = useToast();
    const { verification, updateVerification } = useSettingsStore();
    const [dialogVisible, setDialogVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const readonly = verification.status === 'reviewing';
    const validationMessage = useMemo(() => {
        if (verification.status === 'reviewing') {
            return '';
        }
        if (!verification.realName.trim()) {
            return '请输入真实姓名';
        }
        if (!/^\d{17}[\dXx]$/.test(verification.idCardNo.trim())) {
            return '请输入 18 位身份证号';
        }
        if (!verification.frontImage || !verification.backImage) {
            return '请上传身份证正反面';
        }
        return '';
    }, [verification]);

    const pickImage = async (target: 'frontImage' | 'backImage') => {
        const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
        if (result.didCancel) {
            return;
        }
        if (result.errorCode) {
            showToast({ type: 'error', message: result.errorMessage || '图片选择失败' });
            return;
        }
        const asset = result.assets?.[0];
        if (!asset?.uri) {
            showToast({ type: 'warning', message: '未获取到图片，请重新选择' });
            return;
        }
        updateVerification({ [target]: asset.uri });
    };

    const handleSubmit = async () => {
        if (validationMessage) {
            showToast({ type: 'warning', message: validationMessage });
            return;
        }
        setSubmitting(true);
        try {
            await settingsService.submitVerification();
            setDialogVisible(true);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SettingsLayout title="实名认证" navigation={navigation}>
            <SettingsPageDescription text="认证流程先用前端完整模拟审核态，资料提交、上传反馈和状态展示都保持成套体验。" />

            <View style={styles.statusCard}>
                <View style={styles.statusIconWrap}>
                    <BadgeCheck size={22} color={SETTINGS_COLORS.textPrimary} strokeWidth={2.1} />
                </View>
                <View style={styles.statusTextWrap}>
                    <Text style={styles.statusTitle}>当前状态：{resolveStatusText(verification.status)}</Text>
                    <Text style={styles.statusDesc}>
                        {verification.status === 'reviewing'
                            ? '资料已提交，当前处于审核中。审核完成后会在账号安全页同步状态。'
                            : '提交实名信息后，可用于提升账号可信度与后续支付安全能力。'}
                    </Text>
                </View>
            </View>

            <SettingsSection style={styles.formSection}>
                <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>真实姓名</Text>
                    <TextInput
                        editable={!readonly}
                        value={verification.realName}
                        onChangeText={(realName) => updateVerification({ realName })}
                        placeholder="请输入真实姓名"
                        placeholderTextColor={SETTINGS_COLORS.textMuted}
                        style={[styles.input, readonly && styles.inputReadonly]}
                    />
                </View>
                <View style={styles.fieldWrap}>
                    <Text style={styles.fieldLabel}>身份证号</Text>
                    <TextInput
                        editable={!readonly}
                        value={verification.idCardNo}
                        onChangeText={(idCardNo) => updateVerification({ idCardNo })}
                        placeholder="请输入 18 位身份证号"
                        placeholderTextColor={SETTINGS_COLORS.textMuted}
                        style={[styles.input, readonly && styles.inputReadonly]}
                        autoCapitalize="characters"
                    />
                </View>
                <View style={styles.uploadGrid}>
                    <TouchableOpacity activeOpacity={0.88} style={styles.uploadCard} onPress={() => !readonly && pickImage('frontImage')}>
                        {verification.frontImage ? <Image source={{ uri: verification.frontImage }} style={styles.uploadPreview} /> : <ImagePlus size={24} color={SETTINGS_COLORS.textSecondary} strokeWidth={2.1} />}
                        <Text style={styles.uploadLabel}>身份证正面</Text>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.88} style={styles.uploadCard} onPress={() => !readonly && pickImage('backImage')}>
                        {verification.backImage ? <Image source={{ uri: verification.backImage }} style={styles.uploadPreview} /> : <ImagePlus size={24} color={SETTINGS_COLORS.textSecondary} strokeWidth={2.1} />}
                        <Text style={styles.uploadLabel}>身份证反面</Text>
                    </TouchableOpacity>
                </View>
            </SettingsSection>

            <SettingsActionButton label={readonly ? '资料审核中' : submitting ? '提交中...' : '提交认证资料'} onPress={handleSubmit} disabled={readonly || submitting} />

            <SettingsDialog
                visible={dialogVisible}
                title="资料提交成功"
                message="你的实名资料已进入审核队列，审核结果会在账号安全页同步展示。"
                tone="success"
                onClose={() => {
                    setDialogVisible(false);
                    navigation.goBack();
                }}
            />
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    statusCard: {
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: SETTINGS_COLORS.card,
        padding: 18,
        flexDirection: 'row',
        gap: 12,
    },
    statusIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusTextWrap: {
        flex: 1,
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
        marginBottom: 6,
    },
    statusDesc: {
        fontSize: 14,
        lineHeight: 21,
        color: SETTINGS_COLORS.textSecondary,
    },
    formSection: {
        padding: 18,
        gap: 16,
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
    inputReadonly: {
        opacity: 0.56,
    },
    uploadGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    uploadCard: {
        flex: 1,
        minHeight: 146,
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        overflow: 'hidden',
    },
    uploadPreview: {
        width: '100%',
        height: 96,
    },
    uploadLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: SETTINGS_COLORS.textSecondary,
        paddingBottom: 12,
    },
});

export default RealNameVerificationScreen;
