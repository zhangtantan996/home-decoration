import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SettingsLayout, SettingsPageDescription, SettingsSection } from '../components/settings/SettingsPrimitives';
import { SETTINGS_COLORS, SETTINGS_RADIUS } from '../styles/settingsTheme';
import { settingsService } from '../services/settingsService';
import type { LegalDocumentType } from '../types/settings';

const LegalDocumentScreen = ({ navigation, route }: any) => {
    const documentType = (route.params?.documentType || 'privacy') as LegalDocumentType;
    const document = useMemo(() => settingsService.getLegalDocument(documentType), [documentType]);

    return (
        <SettingsLayout title={document.title} navigation={navigation}>
            <SettingsPageDescription text="这里展示的是移动端内嵌摘要版文档，便于在设置链路中快速查看关键内容。" />
            <SettingsSection style={styles.section}>
                {document.sections.map((section) => (
                    <View key={section} style={styles.block}>
                        <Text style={styles.blockText}>{section}</Text>
                    </View>
                ))}
            </SettingsSection>
        </SettingsLayout>
    );
};

const styles = StyleSheet.create({
    section: {
        padding: 18,
        gap: 14,
    },
    block: {
        borderRadius: SETTINGS_RADIUS.button,
        backgroundColor: SETTINGS_COLORS.cardMuted,
        padding: 16,
    },
    blockText: {
        fontSize: 15,
        lineHeight: 24,
        color: SETTINGS_COLORS.textPrimary,
    },
});

export default LegalDocumentScreen;
