import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { ChevronLeft, User, Briefcase, HardHat, Building2 } from 'lucide-react-native';
import { useIdentityStore } from '../store/identityStore';

const PRIMARY_GOLD = '#D4AF37';

const IDENTITY_TYPES = [
    { value: 'designer', label: '设计师', icon: Briefcase, color: '#8B5CF6', description: '提供专业设计服务' },
    { value: 'worker', label: '工人', icon: HardHat, color: '#F59E0B', description: '提供施工服务' },
    { value: 'company', label: '装修公司', icon: Building2, color: '#10B981', description: '提供一站式装修服务' },
];

const IdentityApplicationScreen = ({ navigation }: any) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const { applyIdentity, loading } = useIdentityStore();

    const handleSubmit = async () => {
        if (!selectedType) {
            Alert.alert('提示', '请选择要申请的身份类型');
            return;
        }

        Alert.alert(
            '确认申请',
            `确定要申请成为${IDENTITY_TYPES.find(t => t.value === selectedType)?.label}吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '确认',
                    onPress: async () => {
                        try {
                            await applyIdentity(selectedType);
                            Alert.alert(
                                '申请成功',
                                '您的申请已提交，我们将在1-3个工作日内完成审核',
                                [
                                    {
                                        text: '确定',
                                        onPress: () => navigation.goBack(),
                                    },
                                ]
                            );
                        } catch (error: any) {
                            Alert.alert('申请失败', error.message || '提交申请失败，请稍后重试');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>申请新身份</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>选择身份类型</Text>
                    <Text style={styles.sectionDesc}>
                        选择您要申请的身份类型，审核通过后即可切换使用
                    </Text>

                    {IDENTITY_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isSelected = selectedType === type.value;

                        return (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.typeCard,
                                    isSelected && styles.typeCardSelected,
                                ]}
                                onPress={() => setSelectedType(type.value)}
                            >
                                <View style={[styles.typeIcon, { backgroundColor: `${type.color}20` }]}>
                                    <Icon size={28} color={type.color} />
                                </View>
                                <View style={styles.typeInfo}>
                                    <Text style={styles.typeLabel}>{type.label}</Text>
                                    <Text style={styles.typeDesc}>{type.description}</Text>
                                </View>
                                <View style={[
                                    styles.radio,
                                    isSelected && styles.radioSelected,
                                ]}>
                                    {isSelected && <View style={styles.radioDot} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>申请说明</Text>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>• 提交申请后，我们将在1-3个工作日内完成审核</Text>
                        <Text style={styles.infoText}>• 审核通过后，您可以在个人中心切换身份</Text>
                        <Text style={styles.infoText}>• 不同身份拥有不同的功能权限</Text>
                        <Text style={styles.infoText}>• 如有疑问，请联系客服咨询</Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.submitBtn,
                        (!selectedType || loading) && styles.submitBtnDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!selectedType || loading}
                >
                    <Text style={styles.submitBtnText}>
                        {loading ? '提交中...' : '提交申请'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
    },
    sectionDesc: {
        fontSize: 14,
        color: '#71717A',
        marginBottom: 20,
        lineHeight: 20,
    },
    typeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeCardSelected: {
        borderColor: PRIMARY_GOLD,
        backgroundColor: '#FFFBEB',
    },
    typeIcon: {
        width: 56,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeInfo: {
        flex: 1,
        marginLeft: 16,
    },
    typeLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 4,
    },
    typeDesc: {
        fontSize: 13,
        color: '#71717A',
    },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#D4D4D8',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    radioSelected: {
        borderColor: PRIMARY_GOLD,
    },
    radioDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: PRIMARY_GOLD,
    },
    infoBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
    },
    infoText: {
        fontSize: 14,
        color: '#71717A',
        lineHeight: 22,
        marginBottom: 8,
    },
    footer: {
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    submitBtn: {
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    submitBtnDisabled: {
        backgroundColor: '#D4D4D8',
    },
    submitBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default IdentityApplicationScreen;
