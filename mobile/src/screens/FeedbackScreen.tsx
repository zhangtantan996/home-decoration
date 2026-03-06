import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ImagePlus, X } from 'lucide-react-native';

import { useToast } from '../components/Toast';
import SettingsBottomSheet from '../components/settings/SettingsBottomSheet';
import SettingsDialog from '../components/settings/SettingsDialog';
import { SettingsActionButton, SettingsLayout, SettingsPageDescription, SettingsRow, SettingsSection } from '../components/settings/SettingsPrimitives';
import { settingsService } from '../services/settingsService';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';

const CATEGORY_OPTIONS = ['产品建议', '功能异常', '体验问题', '其他'];

const FeedbackScreen = ({ navigation }: any) => {
    const { showToast } = useToast();
    const { feedbackDraft, updateFeedbackDraft } = useSettingsStore();
    const [categoryVisible, setCategoryVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successTicket, setSuccessTicket] = useState('');

    const submitDisabled = useMemo(() => feedbackDraft.content.trim().length < 10, [feedbackDraft.content]);

    const handlePickImages = async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 4,
            quality: 0.8,
        });

        if (result.didCancel) {
            return;
        }

        if (result.errorCode) {
            showToast({ type: 'error', message: result.errorMessage || '截图选择失败，请稍后重试' });
            return;
        }

        const screenshots = result.assets?.map((asset) => asset.uri).filter((uri): uri is string => Boolean(uri)) || [];
        updateFeedbackDraft({ screenshots: [...feedbackDraft.screenshots, ...screenshots].slice(0, 4) });
    };

    const handleSubmit = async () => {
        if (submitDisabled) {
            showToast({ type: 'warning', message: '请至少填写 10 个字，方便我们快速定位问题' });
            return;
        }
        setSubmitting(true);
        try {
            const result = await settingsService.submitFeedback(feedbackDraft);
            setSuccessTicket(result.ticketId);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SettingsLayout title="意见反馈" navigation={navigation}>
            <SettingsPageDescription text="反馈页走“少字段、高信息密度”的方式：一眼能看清分类、问题描述和截图附件，不堆多余说明。" />

            <SettingsSection>
                <SettingsRow label="问题类型" value={feedbackDraft.category} onPress={() => setCategoryVisible(true)} last />
            </SettingsSection>

            <SettingsSection style={styles.formSection}>
                <View style={styles.block}>
                    <Text style={styles.label}>问题描述</Text>
                    <TextInput
                        value={feedbackDraft.content}
                        onChangeText={(content) => updateFeedbackDraft({ content })}
                        placeholder="例如：设置页里想更快切到账号安全，或者某个开关文案不够清晰。"
                        placeholderTextColor={SETTINGS_COLORS.textMuted}
                        style={styles.textArea}
                        multiline
                        maxLength={300}
                    />
                    <Text style={styles.counterText}>{feedbackDraft.content.length}/300</Text>
                </View>

                <View style={styles.block}>
                    <Text style={styles.label}>联系方式</Text>
                    <TextInput
                        value={feedbackDraft.contact}
                        onChangeText={(contact) => updateFeedbackDraft({ contact })}
                        placeholder="手机号 / 微信号（选填）"
                        placeholderTextColor={SETTINGS_COLORS.textMuted}
                        style={styles.textInput}
                    />
                </View>

                <View style={styles.block}>
                    <Text style={styles.label}>辅助截图</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageList}>
                        {feedbackDraft.screenshots.map((uri: string, index: number) => (
                            <View key={`${uri}-${index}`} style={styles.imageCard}>
                                <Image source={{ uri }} style={styles.previewImage} />
                                <TouchableOpacity
                                    activeOpacity={0.86}
                                    style={styles.removeImageButton}
                                    onPress={() => updateFeedbackDraft({ screenshots: feedbackDraft.screenshots.filter((item: string) => item !== uri) })}
                                >
                                    <X size={14} color="#FFFFFF" strokeWidth={2.4} />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {feedbackDraft.screenshots.length < 4 ? (
                            <TouchableOpacity activeOpacity={0.88} style={styles.addImageCard} onPress={handlePickImages}>
                                <ImagePlus size={22} color={SETTINGS_COLORS.textSecondary} strokeWidth={2.1} />
                                <Text style={styles.addImageText}>添加截图</Text>
                            </TouchableOpacity>
                        ) : null}
                    </ScrollView>
                </View>
            </SettingsSection>

            <SettingsActionButton label={submitting ? '提交中...' : '提交反馈'} onPress={handleSubmit} disabled={submitting || submitDisabled} />

            <SettingsBottomSheet visible={categoryVisible} onClose={() => setCategoryVisible(false)}>
                <Text style={styles.sheetTitle}>选择反馈类型</Text>
                <Text style={styles.sheetSubtitle}>按类型归档后，产品和设计会更快定位你的问题。</Text>
                <View style={styles.optionList}>
                    {CATEGORY_OPTIONS.map((option) => (
                        <TouchableOpacity
                            key={option}
                            activeOpacity={0.88}
                            style={[styles.optionItem, feedbackDraft.category === option && styles.optionItemActive]}
                            onPress={() => {
                                updateFeedbackDraft({ category: option });
                                setCategoryVisible(false);
                            }}
                        >
                            <Text style={[styles.optionText, feedbackDraft.category === option && styles.optionTextActive]}>{option}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SettingsBottomSheet>

            <SettingsDialog
                visible={Boolean(successTicket)}
                title="反馈已收到"
                message={`我们已收到你的反馈，单号 ${successTicket}。后续如果需要补充说明，可继续提交新的记录。`}
                tone="success"
                onClose={() => {
                    setSuccessTicket('');
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
    block: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    textArea: {
        minHeight: 140,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 16,
        paddingVertical: 16,
        textAlignVertical: 'top',
        fontSize: 16,
        color: SETTINGS_COLORS.textPrimary,
    },
    textInput: {
        minHeight: 56,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 16,
        fontSize: 16,
        color: SETTINGS_COLORS.textPrimary,
    },
    counterText: {
        fontSize: 13,
        color: SETTINGS_COLORS.textSecondary,
        textAlign: 'right',
    },
    imageList: {
        gap: 12,
    },
    imageCard: {
        width: 104,
        height: 104,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: SETTINGS_COLORS.cardMuted,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(17, 17, 17, 0.72)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addImageCard: {
        width: 104,
        height: 104,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: SETTINGS_COLORS.border,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    addImageText: {
        fontSize: 13,
        fontWeight: '600',
        color: SETTINGS_COLORS.textSecondary,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
        marginBottom: 8,
    },
    sheetSubtitle: {
        fontSize: 14,
        lineHeight: 21,
        color: SETTINGS_COLORS.textSecondary,
        marginBottom: 18,
    },
    optionList: {
        gap: 10,
    },
    optionItem: {
        minHeight: 54,
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    optionItemActive: {
        backgroundColor: SETTINGS_COLORS.accent,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: SETTINGS_COLORS.textPrimary,
    },
    optionTextActive: {
        color: '#FFFFFF',
    },
});

export default FeedbackScreen;
