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
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    FlatList,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
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
    X,
    Clock,
} from 'lucide-react-native';
import { bookingApi } from '../services/api';

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
    { id: '4', label: '20-50万' },
    { id: '5', label: '50万以上' },
];

// 时间段选项
const TIME_SLOTS = [
    '08:00-10:00',
    '10:00-12:00',
    '14:00-16:00',
    '16:00-18:00',
    '18:00-20:00',
];

// 生成未来7天日期
const generateWeekDays = () => {
    const days = [];
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const week = weekMap[date.getDay()];
        days.push({
            id: date.toISOString().split('T')[0],
            label: `${month}-${day}`,
            week: week,
            fullDate: `${month}-${day} [${week}]`
        });
    }
    return days;
};

// 手机号脱敏：138****8000
const maskPhone = (phone: string): string => {
    if (!phone || phone.length < 11) return phone;
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

interface BookingScreenProps {
    route: any;
    navigation: any;
}

const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
    const { provider, providerType } = route.params;

    const { user } = useAuthStore();

    // 表单状态
    const [address, setAddress] = useState('');
    const [area, setArea] = useState('');
    const [renovationType, setRenovationType] = useState<string | null>(null);
    const [budget, setBudget] = useState<string | null>(null);
    const [preferredDate, setPreferredDate] = useState('');
    const [notes, setNotes] = useState('');
    const [phone] = useState(user?.phone || ''); // 手机号只读，直接从用户信息获取

    // 日期选择器状态
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [weekDays] = useState(generateWeekDays());
    const [selectedDateIndex, setSelectedDateIndex] = useState(0);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');

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

    const [isSubmitting, setIsSubmitting] = useState(false);

    // 确认时间选择
    const handleConfirmDate = () => {
        if (!selectedTimeSlot) {
            Alert.alert('提示', '请选择具体时间段');
            return;
        }
        const date = weekDays[selectedDateIndex];
        setPreferredDate(`${date.fullDate} ${selectedTimeSlot}`);
        setShowDatePicker(false);
    };

    // 点击空白收起
    const handleDismiss = () => {
        Keyboard.dismiss();
        setShowRenovationPicker(false);
        setShowBudgetPicker(false);
    };

    // 面积输入处理：超过范围自动截断
    const handleAreaChange = (text: string) => {
        // 只允许数字和小数点
        const cleaned = text.replace(/[^0-9.]/g, '');
        if (cleaned === '' || cleaned === '.') {
            setArea(cleaned);
            return;
        }
        const num = parseFloat(cleaned);
        if (num > 9999) {
            setArea('9999');
        } else {
            setArea(cleaned);
        }
    };

    // 失焦时处理最小值
    const handleAreaBlur = () => {
        if (area.trim() === '') return;
        const num = parseFloat(area);
        if (isNaN(num) || num < 10) {
            setArea('10');
        }
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        // 校验逻辑
        if (!address.trim()) {
            Alert.alert('提示', '请输入房屋地址');
            return;
        }
        if (address.trim().length < 5) {
            Alert.alert('提示', '地址至少输入5个字符');
            return;
        }
        if (!area.trim()) {
            Alert.alert('提示', '请输入房屋面积');
            return;
        }
        const areaNum = parseFloat(area);
        if (isNaN(areaNum) || areaNum < 10 || areaNum > 9999) {
            Alert.alert('提示', '房屋面积必须在 10-9999 ㎡ 之间');
            return;
        }
        if (!renovationType) {
            Alert.alert('提示', '请选择装修类型');
            return;
        }
        if (!budget) {
            Alert.alert('提示', '请选择预算范围');
            return;
        }
        if (!phone.trim()) {
            Alert.alert('提示', '请输入联系电话');
            return;
        }
        if (!/^1[3-9]\d{9}$/.test(user?.phone || phone)) {
            Alert.alert('提示', '当前账号手机号格式不正确');
            return;
        }

        setIsSubmitting(true);
        try {
            await bookingApi.create({
                providerId: provider.id,
                providerType: providerType,
                address,
                area: areaNum,
                renovationType,
                budgetRange: budget,
                preferredDate,
                phone: user?.phone || phone,
                notes
            });
            Alert.alert('预约成功', '我们将尽快为您安排服务', [
                { text: '确定', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            Alert.alert('预约失败', error.message || '请稍后重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    // 按钮禁用状态仅在提交中有效，点击时进行具体校验提示
    const isFormValid = true;

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
                <TouchableWithoutFeedback onPress={handleDismiss}>
                    <View style={{ flex: 1 }}>
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
                                        maxLength={100}
                                    />
                                    <Text style={styles.counterText}>{address.length}/100</Text>
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
                                            placeholder="10-9999"
                                            placeholderTextColor="#A1A1AA"
                                            keyboardType="numeric"
                                            value={area}
                                            onChangeText={handleAreaChange}
                                            onBlur={handleAreaBlur}
                                        />
                                        <Text style={styles.unit}>㎡</Text>
                                    </View>
                                </View>

                                {/* 装修类型 */}
                                <View style={styles.formItem}>
                                    <View style={styles.labelRow}>
                                        <Home size={16} color="#71717A" />
                                        <Text style={styles.label}>装修类型</Text>
                                        <Text style={styles.required}>*</Text>
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
                                        <Text style={styles.required}>*</Text>
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
                                    <TouchableOpacity
                                        style={styles.selectInput}
                                        onPress={() => {
                                            handleDismiss();
                                            setShowDatePicker(true);
                                        }}
                                    >
                                        <Text style={[
                                            styles.selectText,
                                            !preferredDate && styles.selectPlaceholder
                                        ]}>
                                            {preferredDate || '请选择上门时间'}
                                        </Text>
                                        <ChevronDown size={18} color="#71717A" />
                                    </TouchableOpacity>
                                </View>

                                {/* 联系电话 */}
                                <View style={styles.formItem}>
                                    <View style={styles.labelRow}>
                                        <Phone size={16} color="#71717A" />
                                        <Text style={styles.label}>联系电话</Text>
                                        <Text style={styles.required}>*</Text>
                                    </View>
                                    <TextInput
                                        style={[styles.input, styles.disabledInput]}
                                        value={maskPhone(phone)}
                                        editable={false}
                                        placeholder="未获取到手机号"
                                    />
                                    <Text style={styles.hintText}>为保障服务质量，默认使用账号注册手机号，如需修改请前往设置</Text>
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
                                        maxLength={500}
                                    />
                                    <Text style={styles.counterText}>{notes.length}/500</Text>
                                </View>
                            </View>

                            <View style={{ height: 100 }} />
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            {/* 底部操作栏 */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitBtnText}>确认预约</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* 时间选择器 Modal */}
            <Modal
                visible={showDatePicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDatePicker(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
                    <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>选择上门时间</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                <X size={24} color="#71717A" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.pickerContainer}>
                            {/* 左侧日期 */}
                            <View style={styles.dateList}>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {weekDays.map((date, index) => (
                                        <TouchableOpacity
                                            key={date.id}
                                            style={[
                                                styles.dateItem,
                                                selectedDateIndex === index && styles.dateItemActive
                                            ]}
                                            onPress={() => {
                                                setSelectedDateIndex(index);
                                                // 切换日期不重置时间，方便用户查看
                                            }}
                                        >
                                            <Text style={[
                                                styles.dateText,
                                                selectedDateIndex === index && styles.dateTextActive
                                            ]}>
                                                {date.label}
                                            </Text>
                                            <Text style={[
                                                styles.weekText,
                                                selectedDateIndex === index && styles.weekTextActive
                                            ]}>
                                                {date.week}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* 右侧时间段 */}
                            <View style={styles.timeList}>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={styles.timeGrid}>
                                        {TIME_SLOTS.map((slot) => (
                                            <TouchableOpacity
                                                key={slot}
                                                style={[
                                                    styles.timeItem,
                                                    selectedTimeSlot === slot && styles.timeItemActive
                                                ]}
                                                onPress={() => setSelectedTimeSlot(slot)}
                                            >
                                                <Clock
                                                    size={14}
                                                    color={selectedTimeSlot === slot ? '#09090B' : '#71717A'}
                                                    style={{ marginRight: 6 }}
                                                />
                                                <Text style={[
                                                    styles.timeText,
                                                    selectedTimeSlot === slot && styles.timeTextActive
                                                ]}>
                                                    {slot}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.confirmBtn}
                            onPress={handleConfirmDate}
                        >
                            <Text style={styles.confirmBtnText}>确认</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
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
    disabledInput: {
        backgroundColor: '#F4F4F5',
        color: '#71717A',
    },
    hintText: {
        fontSize: 12,
        color: '#A1A1AA',
        marginTop: 6,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: 500,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#09090B',
    },
    pickerContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    dateList: {
        width: '30%',
        backgroundColor: '#F8F9FA',
        borderRightWidth: 1,
        borderRightColor: '#F4F4F5',
    },
    dateItem: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    dateItemActive: {
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 3,
        borderLeftColor: '#09090B',
    },
    dateText: {
        fontSize: 15,
        color: '#71717A',
        marginBottom: 4,
    },
    dateTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    weekText: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    weekTextActive: {
        color: '#09090B',
    },
    timeList: {
        width: '70%',
        padding: 16,
    },
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    timeItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    timeItemActive: {
        borderColor: '#09090B',
        backgroundColor: '#F4F4F5',
    },
    timeText: {
        fontSize: 15,
        color: '#71717A',
    },
    timeTextActive: {
        color: '#09090B',
        fontWeight: '500',
    },
    confirmBtn: {
        margin: 16,
        backgroundColor: '#09090B',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    counterText: {
        fontSize: 12,
        color: '#A1A1AA',
        textAlign: 'right',
        marginTop: 4,
    },
});

export default BookingScreen;
