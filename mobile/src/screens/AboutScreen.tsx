import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import SettingsDialog from '../components/settings/SettingsDialog';
import {
    SettingsActionButton,
    SettingsLayout,
    SettingsPageDescription,
    SettingsRow,
    SettingsSection,
} from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { useSettingsStore } from '../store/settingsStore';

const AboutScreen = ({ navigation }: any) => {
    const { about } = useSettingsStore();
    const [dialogVisible, setDialogVisible] = useState(false);

    const versionText = useMemo(() => `v${about.version} (${about.build})`, [about.build, about.version]);

    return (
        <SettingsLayout title="关于筑家" navigation={navigation}>
            <SettingsPageDescription text="关于页保留最常用的信息：版本、更新状态、规则入口和本次设置改版的更新说明。" />

            <SettingsSection style={styles.heroSection}>
                <Text style={styles.appName}>{about.appName}</Text>
                <Text style={styles.versionText}>{versionText}</Text>
                <Text style={styles.versionHint}>当前已是最新版本</Text>
            </SettingsSection>

            <SettingsSection>
                <SettingsRow label="检查更新" value={about.latestVersion === about.version ? '当前已是最新版本' : `发现新版本 ${about.latestVersion}`} onPress={() => setDialogVisible(true)} />
                <SettingsRow label="隐私政策摘要" onPress={() => navigation.navigate('LegalDocument', { documentType: 'privacy' })} />
                <SettingsRow label="用户服务协议摘要" onPress={() => navigation.navigate('LegalDocument', { documentType: 'terms' })} />
                <SettingsRow label="个人信息收集清单" onPress={() => navigation.navigate('LegalDocument', { documentType: 'collection' })} last />
            </SettingsSection>

            <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>最近更新</Text>
                {about.releaseNotes.map((item: string) => (
                    <View key={item} style={styles.noteRow}>
                        <View style={styles.dot} />
                        <Text style={styles.noteText}>{item}</Text>
                    </View>
                ))}
            </View>

            <SettingsActionButton label="查看第三方共享说明" secondary onPress={() => navigation.navigate('LegalDocument', { documentType: 'sharing' })} />

            <SettingsDialog
                visible={dialogVisible}
                title="已经是最新版本"
                message="当前版本已包含设置中心的最新视觉与交互升级，无需额外更新。"
                tone="success"
                onClose={() => setDialogVisible(false)}
            />
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    heroSection: {
        padding: 24,
        alignItems: 'center',
    },
    appName: {
        fontSize: 28,
        fontWeight: '800',
        color: SETTINGS_COLORS.textPrimary,
        marginBottom: 8,
    },
    versionText: {
        fontSize: 15,
        color: SETTINGS_COLORS.textSecondary,
        marginBottom: 6,
    },
    versionHint: {
        fontSize: 14,
        color: SETTINGS_COLORS.textSecondary,
    },
    noteCard: {
        borderRadius: SETTINGS_RADIUS.card,
        backgroundColor: SETTINGS_COLORS.card,
        padding: 18,
        gap: 10,
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: SETTINGS_COLORS.textPrimary,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: SETTINGS_COLORS.textPrimary,
    },
    noteText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 21,
        color: SETTINGS_COLORS.textSecondary,
    },
});

export default AboutScreen;
