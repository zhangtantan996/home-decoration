import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useToast } from '../components/Toast';
import SettingsDialog from '../components/settings/SettingsDialog';
import {
    SettingsActionButton,
    SettingsFooterLink,
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
} from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';

type DialogState = 'logout' | 'switch-account' | 'clear-cache' | null;

const formatModeStatus = (value: boolean) => (value ? '已开启' : '未开启');

const SettingsScreen = ({ navigation }: any) => {
    const { logout } = useAuthStore();
    const { showToast } = useToast();
    const { cache, general, about, clearCache } = useSettingsStore();
    const [dialogState, setDialogState] = useState<DialogState>(null);

    const dialogConfig = useMemo(() => {
        switch (dialogState) {
            case 'logout':
                return {
                    title: '退出当前账号',
                    message: '退出后将返回登录页，但你的设置偏好会保留在本机。',
                    confirmText: '退出登录',
                    cancelText: '再看看',
                    tone: 'danger' as const,
                    onConfirm: async () => {
                        await logout();
                    },
                };
            case 'switch-account':
                return {
                    title: '切换账号',
                    message: '当前会先退出账号，再进入登录页选择其他账号继续使用。',
                    confirmText: '继续',
                    cancelText: '取消',
                    tone: 'default' as const,
                    onConfirm: async () => {
                        await logout();
                    },
                };
            case 'clear-cache':
                return {
                    title: '清理缓存',
                    message: `预计释放 ${cache.totalMB.toFixed(1)} MB，本地缓存图片与临时文件会被移除。`,
                    confirmText: '立即清理',
                    cancelText: '取消',
                    tone: 'warning' as const,
                    onConfirm: () => {
                        const size = clearCache();
                        showToast({ type: 'success', message: `已清理 ${size.toFixed(1)} MB 缓存` });
                    },
                };
            default:
                return null;
        }
    }, [cache.totalMB, clearCache, dialogState, logout, showToast]);

    return (
        <SettingsLayout
            title="设置"
            navigation={navigation}
            footer={
                <View style={styles.footerLinks}>
                    <SettingsFooterLink
                        label="《个人信息收集清单》"
                        onPress={() => navigation.navigate('LegalDocument', { documentType: 'collection' })}
                    />
                    <SettingsFooterLink
                        label="《第三方信息数据共享》"
                        onPress={() => navigation.navigate('LegalDocument', { documentType: 'sharing' })}
                    />
                </View>
            }
        >
            <SettingsPageDescription text="按你常用的节奏整理设置项，先展示重要入口，再把状态类配置折叠成简洁副文案。" />

            <SettingsSection>
                <SettingsRow label="个人信息" onPress={() => navigation.navigate('PersonalInfo')} />
                <SettingsRow label="账号安全" onPress={() => navigation.navigate('AccountSecurity')} />
                <SettingsRow label="隐私设置" onPress={() => navigation.navigate('PrivacySettings')} last />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow label="支付设置" onPress={() => navigation.navigate('PaymentSettings')} />
                <SettingsRow label="消息通知" onPress={() => navigation.navigate('NotificationSettings')} />
                <SettingsRow label="通用设置" onPress={() => navigation.navigate('GeneralSettings')} />
                <SettingsRow
                    label="清理缓存"
                    value={cache.totalMB > 0 ? `${cache.totalMB.toFixed(1)} MB` : '已清理'}
                    onPress={() => setDialogState('clear-cache')}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow
                    label="长辈版"
                    value={formatModeStatus(general.elderModeEnabled)}
                    onPress={() => navigation.navigate('GeneralSettings')}
                />
                <SettingsRow
                    label="未成年人模式"
                    value={formatModeStatus(general.teenModeEnabled)}
                    onPress={() => navigation.navigate('GeneralSettings')}
                    last
                />
            </SettingsSection>

            <SettingsSection>
                <SettingsRow
                    label="关于筑家"
                    value={about.version === about.latestVersion ? '当前已是最新版本' : `可更新至 ${about.latestVersion}`}
                    onPress={() => navigation.navigate('About')}
                />
                <SettingsRow label="意见反馈" onPress={() => navigation.navigate('Feedback')} last />
            </SettingsSection>

            <View style={styles.actionGroup}>
                <SettingsActionButton label="切换账号" secondary onPress={() => setDialogState('switch-account')} />
                <SettingsActionButton label="退出登录" secondary danger onPress={() => setDialogState('logout')} />
            </View>

            {dialogConfig ? (
                <SettingsDialog
                    visible
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    confirmText={dialogConfig.confirmText}
                    cancelText={dialogConfig.cancelText}
                    tone={dialogConfig.tone}
                    onConfirm={dialogConfig.onConfirm}
                    onClose={() => setDialogState(null)}
                />
            ) : null}
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    actionGroup: {
        gap: 12,
    },
    footerLinks: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
        paddingBottom: 4,
    },
    footerHint: {
        fontSize: 12,
        color: SETTINGS_COLORS.textSecondary,
        textAlign: 'center',
    },
});

export default SettingsScreen;
