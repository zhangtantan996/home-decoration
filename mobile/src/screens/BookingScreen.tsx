import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    Image,
    TouchableOpacity,
    TextInput,
    Dimensions,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import {
    ArrowLeft,
    Star,
    MapPin,
    Calendar,
    Home,
    Ruler,
    DollarSign,
    Phone,
    FileText,
    ChevronDown,
    Check,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// 装修类型选项
const RENOVATION_TYPES = [
    { id: 'new', label: '新房装修' },
    { id: 'old', label: '老房翻新' },
    { id: 'partial', label: '局部改造' },
];

// 预算范围选项
const BUDGET_RANGES = [
    { id: '1', label: '5万以下' },
    { id: '2', label: '5-10万' },
    { id: '3', label: '10-20万' },
    { id: '4', label: '20-50万' },
    { id: '5', label: '50万以上' },
];

interface BookingScreenProps {
    route: any;
    navigation: any;
}

const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
    const { provider, providerType } = route.params;

    // 表单状态
    const [address, setAddress] = useState('');
    const [area, setArea] = useState('');
    const [renovationType, setRenovationType] = useState<string | null>(null);
    const [budget, setBudget] = useState<string | null>(null);
    const [preferredDate, setPreferredDate] = useState('');
    const [notes, setNotes] = useState('');
    const [phone, setPhone] = useState('');

    // 下拉菜单状态
    const [showRenovationPicker, setShowRenovationPicker] = useState(false);
    const [showBudgetPicker, setShowBudgetPicker] = useState(false);

    // 获取服务提供者的显示信息
    const getProviderInfo = () => {
        if (providerType === 'designer') {
            return {
                name: provider.name,
                avatar: provider.avatar,
                rating: provider.rating,
                subtitle: `${provider.yearsExperience}年经验 · ${provider.specialty}`,
                typeLabel: '设计师',
            };
        } else if (providerType === 'worker') {
            return {
                name: provider.name,
                avatar: provider.avatar,
                rating: provider.rating,
                subtitle: `${provider.yearsExperience}年经验 · ${provider.workTypeLabels}`,
                typeLabel: '施工师傅',
            };
        } else {
            return {
                name: provider.name,
                avatar: provider.logo,
                rating: provider.rating,
                subtitle: `成立${new Date().getFullYear() - provider.establishedYear}年 · ${provider.workTypeLabels}`,
                typeLabel: '装修公司',
            };
        }
    };

    const providerInfo = getProviderInfo();

    const handleSubmit = () => {
        // TODO: 实现预约提交逻辑
        console.log('提交预约:', {
            provider,
            providerType,
            address,
            area,
            renovationType,
            budget,
            preferredDate,
            notes,
            phone,
        });
        // 显示成功提示并返回
        navigation.goBack();
    };

    const isFormValid = address.trim() && area.trim() && phone.trim();

    return (
        <SafeAreaView style={styles.container}>
            {/* 全局已在 App.tsx 配置 StatusBar */}

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>预约服务</Text>
                <View style={styles.placeholder} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* 服务提供者信息卡片 */}
                    <View style={styles.providerCard}>
                        <Image
                            source={{ uri: providerInfo.avatar }}
                            style={styles.providerAvatar}
                        />
                        <View style={styles.providerInfo}>
                            <View style={styles.providerNameRow}>
                                <Text style={styles.providerName}>{providerInfo.name}</Text>
                                <View style={styles.typeBadge}>
                                    <Text style={styles.typeBadgeText}>{providerInfo.typeLabel}</Text>
                                </View>
                            </View>
                            <View style={styles.ratingRow}>
                                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                                <Text style={styles.ratingText}>{providerInfo.rating}</Text>
                            </View>
                            <Text style={styles.providerSubtitle} numberOfLines={1}>
                                {providerInfo.subtitle}
                            </Text>
                        </View>
                    </View>

                    {/* 预约表单 */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>预约信息</Text>

                        {/* 房屋地址 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <MapPin size={16} color="#71717A" />
                                <Text style={styles.label}>房屋地址</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="请输入详细地址"
                                placeholderTextColor="#A1A1AA"
                                value={address}
                                onChangeText={setAddress}
                            />
                        </View>

                        {/* 房屋面积 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Ruler size={16} color="#71717A" />
                                <Text style={styles.label}>房屋面积</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <View style={styles.inputWithUnit}>
                                <TextInput
                                    style={[styles.input, styles.inputFlex]}
                                    placeholder="请输入面积"
                                    placeholderTextColor="#A1A1AA"
                                    keyboardType="numeric"
                                    value={area}
                                    onChangeText={setArea}
                                />
                                <Text style={styles.unit}>㎡</Text>
                            </View>
                        </View>

                        {/* 装修类型 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Home size={16} color="#71717A" />
                                <Text style={styles.label}>装修类型</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => setShowRenovationPicker(!showRenovationPicker)}
                            >
                                <Text style={[
                                    styles.selectText,
                                    !renovationType && styles.selectPlaceholder
                                ]}>
                                    {renovationType
                                        ? RENOVATION_TYPES.find(t => t.id === renovationType)?.label
                                        : '请选择装修类型'}
                                </Text>
                                <ChevronDown size={18} color="#71717A" />
                            </TouchableOpacity>
                            {showRenovationPicker && (
                                <View style={styles.pickerOptions}>
                                    {RENOVATION_TYPES.map(type => (
                                        <TouchableOpacity
                                            key={type.id}
                                            style={[
                                                styles.pickerOption,
                                                renovationType === type.id && styles.pickerOptionActive
                                            ]}
                                            onPress={() => {
                                                setRenovationType(type.id);
                                                setShowRenovationPicker(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.pickerOptionText,
                                                renovationType === type.id && styles.pickerOptionTextActive
                                            ]}>
                                                {type.label}
                                            </Text>
                                            {renovationType === type.id && (
                                                <Check size={16} color="#09090B" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* 预算范围 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <DollarSign size={16} color="#71717A" />
                                <Text style={styles.label}>预算范围</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => setShowBudgetPicker(!showBudgetPicker)}
                            >
                                <Text style={[
                                    styles.selectText,
                                    !budget && styles.selectPlaceholder
                                ]}>
                                    {budget
                                        ? BUDGET_RANGES.find(b => b.id === budget)?.label
                                        : '请选择预算范围'}
                                </Text>
                                <ChevronDown size={18} color="#71717A" />
                            </TouchableOpacity>
                            {showBudgetPicker && (
                                <View style={styles.pickerOptions}>
                                    {BUDGET_RANGES.map(range => (
                                        <TouchableOpacity
                                            key={range.id}
                                            style={[
                                                styles.pickerOption,
                                                budget === range.id && styles.pickerOptionActive
                                            ]}
                                            onPress={() => {
                                                setBudget(range.id);
                                                setShowBudgetPicker(false);
                                            }}
                                        >
                                            <Text style={[
                                                styles.pickerOptionText,
                                                budget === range.id && styles.pickerOptionTextActive
                                            ]}>
                                                {range.label}
                                            </Text>
                                            {budget === range.id && (
                                                <Check size={16} color="#09090B" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* 期望上门时间 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Calendar size={16} color="#71717A" />
                                <Text style={styles.label}>期望上门时间</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="如：本周六下午"
                                placeholderTextColor="#A1A1AA"
                                value={preferredDate}
                                onChangeText={setPreferredDate}
                            />
                        </View>

                        {/* 联系电话 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Phone size={16} color="#71717A" />
                                <Text style={styles.label}>联系电话</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="请输入您的联系电话"
                                placeholderTextColor="#A1A1AA"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />
                        </View>

                        {/* 补充说明 */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <FileText size={16} color="#71717A" />
                                <Text style={styles.label}>补充说明</Text>
                            </View>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="请描述您的装修需求、特殊要求等（选填）"
                                placeholderTextColor="#A1A1AA"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                value={notes}
                                onChangeText={setNotes}
                            />
                        </View>
                    </View>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* 底部操作栏 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.submitBtn, !isFormValid && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!isFormValid}
                >
                    <Text style={styles.submitBtnText}>确认预约</Text>
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
        paddingTop: Platform.OS === 'ios' ? 12 : 44, // 适配沉浸式状态栏
        paddingBottom: 12,
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
    placeholder: {
        width: 32,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    // 服务提供者卡片
    providerCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginTop: 12,
        marginHorizontal: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    providerAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E5E7EB',
    },
    providerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
    },
    typeBadge: {
        backgroundColor: '#F0F9FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    typeBadgeText: {
        fontSize: 11,
        color: '#0369A1',
        fontWeight: '500',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#09090B',
        marginLeft: 4,
    },
    providerSubtitle: {
        fontSize: 12,
        color: '#71717A',
    },
    // 表单区域
    formSection: {
        backgroundColor: '#FFFFFF',
        marginTop: 12,
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 16,
    },
    formItem: {
        marginBottom: 16,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: '#09090B',
        marginLeft: 6,
        fontWeight: '500',
    },
    required: {
        color: '#EF4444',
        marginLeft: 2,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: '#09090B',
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    inputWithUnit: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputFlex: {
        flex: 1,
    },
    unit: {
        fontSize: 14,
        color: '#71717A',
        marginLeft: 8,
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    selectInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    selectText: {
        fontSize: 14,
        color: '#09090B',
    },
    selectPlaceholder: {
        color: '#A1A1AA',
    },
    pickerOptions: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        overflow: 'hidden',
    },
    pickerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    pickerOptionActive: {
        backgroundColor: '#F8F9FA',
    },
    pickerOptionText: {
        fontSize: 14,
        color: '#71717A',
    },
    pickerOptionTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    // 底部操作栏
    bottomBar: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 28 : 12,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    submitBtn: {
        backgroundColor: '#09090B',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitBtnDisabled: {
        backgroundColor: '#D4D4D8',
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BookingScreen;
