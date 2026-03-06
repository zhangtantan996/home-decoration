import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useToast } from '../components/Toast';
import SettingsDialog from '../components/settings/SettingsDialog';
import { SettingsActionButton, SettingsLayout, SettingsPageDescription, SettingsSection } from '../components/settings/SettingsPrimitives';
import { settingsService } from '../services/settingsService';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';

const DeviceManagementScreen = ({ navigation }: any) => {
    const { showToast } = useToast();
    const { devices } = useSettingsStore();
    const [targetDeviceId, setTargetDeviceId] = useState<string | null>(null);
    const [clearOthersVisible, setClearOthersVisible] = useState(false);

    const targetDevice = useMemo(() => devices.find((device) => device.id === targetDeviceId) || null, [devices, targetDeviceId]);

    return (
        <SettingsLayout title="登录设备管理" navigation={navigation}>
            <SettingsPageDescription text="先把当前设备和历史登录设备明确区分，单设备退出和批量清理都用统一确认弹窗完成。" />

            <SettingsSection style={styles.listSection}>
                {devices.map((device) => (
                    <View key={device.id} style={[styles.deviceRow, device.id === devices[devices.length - 1]?.id && styles.deviceRowLast]}>
                        <View style={styles.deviceInfo}>
                            <Text style={styles.deviceName}>{device.name}</Text>
                            <Text style={styles.deviceMeta}>{`${device.platform} · ${device.location}`}</Text>
                            <Text style={styles.deviceMeta}>{device.lastActiveAt}</Text>
                        </View>
                        {device.isCurrent ? (
                            <View style={styles.currentBadge}>
                                <Text style={styles.currentBadgeText}>当前设备</Text>
                            </View>
                        ) : (
                            <TouchableOpacity activeOpacity={0.86} style={styles.removeButton} onPress={() => setTargetDeviceId(device.id)}>
                                <Text style={styles.removeButtonText}>退出</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </SettingsSection>

            <SettingsActionButton
                label="退出其他设备"
                secondary
                onPress={() => setClearOthersVisible(true)}
                disabled={devices.filter((device) => !device.isCurrent).length === 0}
            />

            <SettingsDialog
                visible={Boolean(targetDevice)}
                title="退出该设备"
                message={targetDevice ? `退出 ${targetDevice.name} 后，该设备需要重新登录才能继续访问。` : ''}
                confirmText="确认退出"
                cancelText="取消"
                tone="danger"
                onConfirm={async () => {
                    if (!targetDevice) {
                        return;
                    }
                    await settingsService.revokeDevice(targetDevice.id);
                    showToast({ type: 'success', message: `${targetDevice.name} 已退出登录` });
                }}
                onClose={() => setTargetDeviceId(null)}
            />

            <SettingsDialog
                visible={clearOthersVisible}
                title="退出其他设备"
                message="除当前设备外，其他历史登录设备会全部失效。下次在这些设备上使用时需重新登录。"
                confirmText="确认退出"
                cancelText="取消"
                tone="danger"
                onConfirm={async () => {
                    await settingsService.revokeOtherDevices();
                    showToast({ type: 'success', message: '其他设备已全部退出登录' });
                }}
                onClose={() => setClearOthersVisible(false)}
            />
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    listSection: {
        paddingHorizontal: 18,
    },
    deviceRow: {
        minHeight: 86,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: SETTINGS_COLORS.divider,
        gap: 12,
    },
    deviceRowLast: {
        borderBottomWidth: 0,
    },
    deviceInfo: {
        flex: 1,
        gap: 4,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    deviceMeta: {
        fontSize: 13,
        color: SETTINGS_COLORS.textSecondary,
    },
    currentBadge: {
        borderRadius: SETTINGS_RADIUS.pill,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    currentBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    removeButton: {
        borderRadius: SETTINGS_RADIUS.pill,
        backgroundColor: '#FFF5F5',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    removeButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: SETTINGS_COLORS.danger,
    },
});

export default DeviceManagementScreen;
