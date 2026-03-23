import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import SettingsBottomSheet from '../components/settings/SettingsBottomSheet';
import {
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
    SettingsSwitch,
} from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';

const QUIET_OPTIONS = ['22:00 - 08:00', '23:00 - 07:00', '00:00 - 08:00'];

const NotificationSettingsScreen = ({ navigation }: any) => {
    const { notifications, updateNotifications } = useSettingsStore();
    const [sheetVisible, setSheetVisible] = useState(false);

    return (
        <SettingsLayout title="通知提醒" navigation={navigation}>
            <SettingsPageDescription text="通知只保留真正有用的四类提醒，营销和免打扰单独控制，尽量避免打断。" />

            <SettingsSection>
                <SettingsRow
                    label="系统通知"
                    hint="版本更新、平台公告与安全提醒。"
                    rightNode={<SettingsSwitch value={notifications.systemEnabled} onValueChange={(value) => updateNotifications({ systemEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="项目进度提醒"
                    hint="阶段更新、节点延期、验收确认。"
                    rightNode={<SettingsSwitch value={notifications.projectEnabled} onValueChange={(value) => updateNotifications({ projectEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="订单与支付提醒"
                    hint="待付款、退款进度、设计费支付结果。"
                    rightNode={<SettingsSwitch value={notifications.orderEnabled} onValueChange={(value) => updateNotifications({ orderEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="营销活动"
                    hint="促销、限时优惠和运营活动。"
                    rightNode={<SettingsSwitch value={notifications.marketingEnabled} onValueChange={(value) => updateNotifications({ marketingEnabled: value })} />}
                    withChevron={false}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow
                    label="免打扰"
                    hint="开启后，仅保留关键安全与交易提醒。"
                    rightNode={<SettingsSwitch value={notifications.quietModeEnabled} onValueChange={(value) => updateNotifications({ quietModeEnabled: value })} />}
                    withChevron={false}
                />
                <SettingsRow
                    label="免打扰时段"
                    value={notifications.quietHoursLabel}
                    onPress={() => setSheetVisible(true)}
                    last
                />
            </SettingsSection>

            <SettingsBottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
                <Text style={styles.sheetTitle}>选择免打扰时段</Text>
                <Text style={styles.sheetSubtitle}>选择后会同步更新首页与通知页展示的安静时段文案。</Text>
                <View style={styles.optionList}>
                    {QUIET_OPTIONS.map((option) => (
                        <TouchableOpacity
                            key={option}
                            activeOpacity={0.86}
                            style={[styles.optionItem, notifications.quietHoursLabel === option && styles.optionItemActive]}
                            onPress={() => {
                                updateNotifications({ quietHoursLabel: option });
                                setSheetVisible(false);
                            }}
                        >
                            <Text style={[styles.optionLabel, notifications.quietHoursLabel === option && styles.optionLabelActive]}>{option}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SettingsBottomSheet>
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

export default NotificationSettingsScreen;
