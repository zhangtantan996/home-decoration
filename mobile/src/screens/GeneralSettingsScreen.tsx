import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useToast } from '../components/Toast';
import SettingsBottomSheet from '../components/settings/SettingsBottomSheet';
import SettingsDialog from '../components/settings/SettingsDialog';
import {
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
    SettingsSwitch,
} from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';

const FONT_OPTIONS = [
    { key: 'standard', label: '标准显示' },
    { key: 'large', label: '大字号显示' },
];

const resolveStatus = (value: boolean) => (value ? '已开启' : '未开启');

const GeneralSettingsScreen = ({ navigation }: any) => {
    const { showToast } = useToast();
    const { general, cache, updateGeneral, clearCache } = useSettingsStore();
    const [fontSheetVisible, setFontSheetVisible] = useState(false);
    const [dialogVisible, setDialogVisible] = useState(false);

    const dialogMessage = useMemo(
        () => `清理后将释放 ${cache.totalMB.toFixed(1)} MB，本地下载与预览缓存会重新生成。`,
        [cache.totalMB]
    );

    return (
        <SettingsLayout title="通用设置" navigation={navigation}>
            <SettingsPageDescription text="把常驻偏好收纳在这里，入口和副文案尽量靠近参考图，让首页信息更克制。" />

            <SettingsSection>
                <SettingsRow
                    label="长辈版"
                    value={resolveStatus(general.elderModeEnabled)}
                    hint="放大字号、提高对比度，适合长辈快速查看。"
                    rightNode={<SettingsSwitch value={general.elderModeEnabled} onValueChange={(value) => updateGeneral({ elderModeEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="未成年人模式"
                    value={resolveStatus(general.teenModeEnabled)}
                    hint="减少营销内容与夜间提醒，优先展示必要通知。"
                    rightNode={<SettingsSwitch value={general.teenModeEnabled} onValueChange={(value) => updateGeneral({ teenModeEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="列表紧凑模式"
                    rightNode={<SettingsSwitch value={general.compactModeEnabled} onValueChange={(value) => updateGeneral({ compactModeEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="自动播放预览"
                    rightNode={<SettingsSwitch value={general.autoPlayEnabled} onValueChange={(value) => updateGeneral({ autoPlayEnabled: value })} />}
                    withChevron={false}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow
                    label="字体显示"
                    value={general.fontScale === 'large' ? '大字号显示' : '标准显示'}
                    onPress={() => setFontSheetVisible(true)}
                />
                <SettingsRow
                    label="清理缓存"
                    value={cache.totalMB > 0 ? `${cache.totalMB.toFixed(1)} MB` : '已清理'}
                    onPress={() => setDialogVisible(true)}
                    last
                />
            </SettingsSection>

            <SettingsBottomSheet visible={fontSheetVisible} onClose={() => setFontSheetVisible(false)}>
                <Text style={styles.sheetTitle}>字体显示</Text>
                <Text style={styles.sheetSubtitle}>设置会即时生效，并在下次打开设置页时继续保留。</Text>
                <View style={styles.optionList}>
                    {FONT_OPTIONS.map((option) => (
                        <TouchableOpacity
                            key={option.key}
                            activeOpacity={0.88}
                            style={[styles.optionItem, general.fontScale === option.key && styles.optionItemActive]}
                            onPress={() => {
                                updateGeneral({ fontScale: option.key as 'standard' | 'large' });
                                setFontSheetVisible(false);
                            }}
                        >
                            <Text style={[styles.optionLabel, general.fontScale === option.key && styles.optionLabelActive]}>{option.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SettingsBottomSheet>

            <SettingsDialog
                visible={dialogVisible}
                title="确认清理缓存"
                message={dialogMessage}
                confirmText="立即清理"
                cancelText="取消"
                tone="warning"
                onConfirm={() => {
                    const released = clearCache();
                    showToast({ type: 'success', message: `已释放 ${released.toFixed(1)} MB` });
                }}
                onClose={() => setDialogVisible(false)}
            />
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
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
    optionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: SETTINGS_COLORS.textPrimary,
    },
    optionLabelActive: {
        color: '#FFFFFF',
    },
});

export default GeneralSettingsScreen;
