import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Linking,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    Home,
    FileText,
    Shield,
    Mail,
    ChevronRight,
    Star,
    ChevronDown,
    ChevronUp,
} from 'lucide-react-native';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';
const APP_VERSION = '2.4.1';
const BUILD_NUMBER = '(241)';

interface AboutScreenProps {
    navigation: any;
}

const CHANGELOG = [
    { version: 'v2.4.1', date: '2026-03-01', notes: ['修复了部分设备闪退问题', '优化首页加载速度', '改善聊天消息实时性'] },
    { version: 'v2.4.0', date: '2026-02-15', notes: ['新增意见反馈功能', '支付流程优化', '设计师主页全新改版', '新增收藏夹功能'] },
    { version: 'v2.3.0', date: '2026-01-20', notes: ['推出会员体系', '新增施工进度实时追踪', '多媒体消息支持'] },
];

const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
    const [changelogExpanded, setChangelogExpanded] = useState(false);

    const links = [
        {
            label: '用户协议',
            icon: <FileText size={18} color="#3B82F6" />,
            iconBg: '#EFF6FF',
            onPress: () => Linking.openURL('https://example.com/terms'),
        },
        {
            label: '隐私政策',
            icon: <Shield size={18} color="#8B5CF6" />,
            iconBg: '#F3F0FF',
            onPress: () => Linking.openURL('https://example.com/privacy'),
        },
        {
            label: '联系我们',
            icon: <Mail size={18} color="#10B981" />,
            iconBg: '#ECFDF5',
            onPress: () => Linking.openURL('mailto:support@nestcraft.com'),
        },
        {
            label: '给我们评分',
            icon: <Star size={18} color={PRIMARY_GOLD} />,
            iconBg: GOLD_LIGHT,
            onPress: () => Linking.openURL('https://example.com/rate'),
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>关于</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* App 标识区 */}
                <View style={styles.appBrand}>
                    <View style={styles.appIconContainer}>
                        <View style={styles.appIconInner}>
                            <Home size={36} color="#FFFFFF" strokeWidth={1.5} />
                        </View>
                    </View>
                    <Text style={styles.appName}>NestCraft</Text>
                    <Text style={styles.appSlogan}>美好家居，由此开始</Text>
                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>版本 {APP_VERSION} {BUILD_NUMBER}</Text>
                    </View>
                </View>

                {/* 更新日志 */}
                <Text style={styles.sectionLabel}>更新日志</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.changelogHeaderRow}
                        onPress={() => setChangelogExpanded(!changelogExpanded)}
                    >
                        <View>
                            <Text style={styles.changelogVersionBig}>{CHANGELOG[0].version}</Text>
                            <Text style={styles.changelogDate}>{CHANGELOG[0].date}</Text>
                        </View>
                        {changelogExpanded
                            ? <ChevronUp size={18} color="#A1A1AA" />
                            : <ChevronDown size={18} color="#A1A1AA" />
                        }
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    {(changelogExpanded ? CHANGELOG : [CHANGELOG[0]]).map((entry, entryIndex) => (
                        <View key={entry.version}>
                            {entryIndex !== 0 && (
                                <View style={styles.olderEntry}>
                                    <Text style={styles.olderVersion}>{entry.version}</Text>
                                    <Text style={styles.changelogDate}>{entry.date}</Text>
                                </View>
                            )}
                            <View style={styles.notesList}>
                                {entry.notes.map((note, i) => (
                                    <View key={i} style={styles.noteRow}>
                                        <View style={styles.noteDot} />
                                        <Text style={styles.noteText}>{note}</Text>
                                    </View>
                                ))}
                            </View>
                            {entryIndex !== (changelogExpanded ? CHANGELOG.length - 1 : 0) && (
                                <View style={styles.divider} />
                            )}
                        </View>
                    ))}
                </View>

                {/* 链接 */}
                <Text style={styles.sectionLabel}>相关信息</Text>
                <View style={styles.card}>
                    {links.map((item, index) => (
                        <View key={item.label}>
                            <TouchableOpacity style={styles.linkRow} onPress={item.onPress}>
                                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                                    {item.icon}
                                </View>
                                <Text style={styles.linkLabel}>{item.label}</Text>
                                <ChevronRight size={18} color="#A1A1AA" />
                            </TouchableOpacity>
                            {index !== links.length - 1 && <View style={styles.divider} />}
                        </View>
                    ))}
                </View>

                {/* 版权 */}
                <View style={styles.copyrightSection}>
                    <Text style={styles.copyrightText}>© 2026 NestCraft Technology Co., Ltd.</Text>
                    <Text style={styles.copyrightText}>保留所有权利</Text>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F7FA' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 12 : 44,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E4E4E7',
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#09090B' },
    placeholder: { width: 32 },
    content: { flex: 1, paddingHorizontal: 16 },
    appBrand: {
        alignItems: 'center',
        paddingVertical: 36,
    },
    appIconContainer: {
        width: 90,
        height: 90,
        borderRadius: 24,
        padding: 3,
        backgroundColor: PRIMARY_GOLD,
        shadowColor: PRIMARY_GOLD,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 16,
    },
    appIconInner: {
        flex: 1,
        borderRadius: 21,
        backgroundColor: '#09090B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appName: { fontSize: 26, fontWeight: '800', color: '#09090B', letterSpacing: 0.5 },
    appSlogan: { fontSize: 13, color: '#71717A', marginTop: 4, marginBottom: 12 },
    versionBadge: {
        backgroundColor: GOLD_LIGHT,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },
    versionText: { fontSize: 12, color: '#78550A', fontWeight: '600' },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#71717A',
        marginTop: 22,
        marginBottom: 10,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    changelogHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    changelogVersionBig: { fontSize: 15, fontWeight: '700', color: '#09090B', marginBottom: 2 },
    changelogDate: { fontSize: 12, color: '#A1A1AA' },
    olderEntry: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
    olderVersion: { fontSize: 14, fontWeight: '600', color: '#52525B', marginBottom: 2 },
    notesList: { paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
    noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    noteDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: PRIMARY_GOLD,
        marginTop: 7,
    },
    noteText: { flex: 1, fontSize: 13, color: '#52525B', lineHeight: 20 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginHorizontal: 16 },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkLabel: { flex: 1, fontSize: 15, color: '#09090B' },
    copyrightSection: { alignItems: 'center', paddingVertical: 28, gap: 4 },
    copyrightText: { fontSize: 12, color: '#A1A1AA' },
    bottomSpacer: { height: 20 },
});

export default AboutScreen;
