import React, { useState, useRef, useMemo } from 'react';
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
    ActivityIndicator,
    Modal,
    Pressable,
    Keyboard,
    Animated,
    KeyboardAvoidingView,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import {
    ArrowLeft,
    Star,
    Home,
    Ruler,
    DollarSign,
    Phone,
    ChevronDown,
    Check,
    X,
    User,
    FileText,
    MapPin,
    Calendar,
    CheckCircle,
} from 'lucide-react-native';
import { bookingApi } from '../services/api';
import { useToast } from '../components/Toast';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/AppNavigator';

type BookingScreenRouteProp = RouteProp<RootStackParamList, 'Booking'>;
type BookingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface BookingScreenProps {
    route: BookingScreenRouteProp;
    navigation: BookingScreenNavigationProp;
}

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

const TIME_SLOTS = [
    { id: 'morning', label: '上午 (09:00-12:00)' },
    { id: 'afternoon', label: '下午 (14:00-18:00)' },
    { id: 'evening', label: '晚上 (19:00-21:00)' },
];

// 生成未来7天日期
interface WeekDay {
    id: string;
    label: string;
    week: string;
    fullDate: string;
}

const generateWeekDays = (): WeekDay[] => {
    const days: WeekDay[] = [];
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

const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
    const { showAlert } = useToast();

    // Navigation passes { provider: DesignerObject, providerType: 'designer' }
    const params = route.params || {};
    const providerData = (params as any).provider || {}; // The actual provider object
    const providerType = (params as any).providerType || 'company';

    const { user } = useAuthStore();

    // Provider Info with Fallbacks - Extract from the nested provider object
    const provider = {
        id: providerData.id || '',
        name: providerData.name || '优选服务商', // Fallback name
        avatar: providerData.avatar || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158', // Fallback image
        rating: providerData.rating || 5.0,
        // Field names match HomeScreen card data structure
        yearsExperience: providerData.yearsExperience || '', // e.g., 8 (number)
        specialty: providerData.specialty || '', // e.g., "现代简约" (string)
    };

    // Form State
    const [address, setAddress] = useState('');
    const [area, setArea] = useState('');
    // const [layout, setLayout] = useState('1室1厅1卫'); // Derived from individual states
    const [renovationType, setRenovationType] = useState('new');
    const [budget, setBudget] = useState('');
    const [preferredDate, setPreferredDate] = useState('');
    const [phone] = useState(user?.phone || '');
    const [notes, setNotes] = useState('');

    // Layout Picker State
    const [room, setRoom] = useState(2);
    const [hall, setHall] = useState(1);
    const [toilet, setToilet] = useState(1);
    const [showLayoutPicker, setShowLayoutPicker] = useState(false);

    // Budget Dropdown State
    const [showBudgetDropdown, setShowBudgetDropdown] = useState(false);

    // Date Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempSelectedDate, setTempSelectedDate] = useState('');
    const [tempSelectedTime, setTempSelectedTime] = useState('');

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
    const [selectedDateIndex, setSelectedDateIndex] = useState(0);

    // Helper to close all dropdowns/menus
    const closeMenus = () => {
        if (showBudgetDropdown) setShowBudgetDropdown(false);
        Keyboard.dismiss();
    };

    // Data
    const weekDays = useMemo(() => generateWeekDays(), []);

    // Time Slots
    const TIME_SLOTS = [
        { id: 'slot1', label: '09:00-12:00 上午' },
        { id: 'slot2', label: '14:00-18:00 下午' },
        { id: 'slot3', label: '19:00-21:00 晚上' },
    ];

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorField, setErrorField] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    // ScrollView ref and Field Positions
    const scrollViewRef = useRef<ScrollView>(null);
    const fieldPositions = useRef<Record<string, number>>({});

    // Layout Options
    const ROOM_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 1);
    const HALL_OPTIONS = Array.from({ length: 6 }, (_, i) => i);
    const TOILET_OPTIONS = Array.from({ length: 6 }, (_, i) => i);

    // Get Provider Info for Display
    const getProviderInfo = () => {
        const base = {
            name: provider.name,
            avatar: provider.avatar,
            rating: provider.rating,
        };

        // Build subtitle from yearsExperience and specialty
        const buildSubtitle = () => {
            const parts: string[] = [];
            if (provider.yearsExperience) parts.push(`${provider.yearsExperience}年经验`);
            if (provider.specialty) parts.push(provider.specialty.replace(/[,，]/g, ' · '));
            return parts.length > 0 ? parts.join(' · ') : null;
        };
        const dynamicSubtitle = buildSubtitle();

        if (providerType === 'designer') {
            return { ...base, subtitle: dynamicSubtitle || `${provider.rating}分 · 资深设计师`, typeLabel: '设计师' };
        } else if (providerType === 'worker') {
            return { ...base, subtitle: dynamicSubtitle || `${provider.rating}分 · 专业工长`, typeLabel: '施工师傅' };
        } else {
            return { ...base, subtitle: dynamicSubtitle || `品质装修服务`, typeLabel: '装修公司' };
        }
    };

    const providerInfo = getProviderInfo();

    // Confirm Date Selection
    const handleConfirmDate = () => {
        // Logic moved to direct selection in this simpler version, 
        // but if we had a complex picker with time slots, we'd use this.
    };

    // Validations (Keep existing logic)
    const handleAreaChange = (text: string) => {
        const cleaned = text.replace(/[^0-9.]/g, '');
        if (cleaned === '' || cleaned === '.') {
            setArea(cleaned);
            return;
        }
        const num = parseFloat(cleaned);
        if (num > 9999) setArea('9999');
        else setArea(cleaned);
    };

    const handleAreaBlur = () => {
        if (area.trim() === '') {
            setFormError('请输入房屋面积');
            setErrorField('area');
            return;
        }
        const num = parseFloat(area);
        if (isNaN(num) || num < 10) setArea('10');
        if (errorField === 'area') {
            setFormError(null);
            setErrorField(null);
        }
    };

    const handleAddressBlur = () => {
        if (!address.trim()) {
            setFormError('请输入房屋地址');
            setErrorField('address');
        } else if (address.trim().length < 5) {
            setFormError('地址至少输入5个字符');
            setErrorField('address');
        } else if (errorField === 'address') {
            setFormError(null);
            setErrorField(null);
        }
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setFormError(null);
        setErrorField(null);

        // Validation Chain
        if (!address.trim()) { setFormError('请输入房屋地址'); setErrorField('address'); return; }
        if (address.trim().length < 5) { setFormError('地址至少输入5个字符'); setErrorField('address'); return; }
        if (!area.trim()) { setFormError('请输入房屋面积'); setErrorField('area'); return; }
        const areaNum = parseFloat(area);
        if (isNaN(areaNum) || areaNum < 10 || areaNum > 9999) { setFormError('房屋面积必须在 10-9999 ㎡ 之间'); setErrorField('area'); return; }
        if (!renovationType) { setFormError('请选择装修类型'); setErrorField('renovationType'); return; }
        if (!budget) { setFormError('请选择预算范围'); setErrorField('budget'); return; }
        if (!preferredDate) { setFormError('请选择期望上门时间'); setErrorField('preferredDate'); return; }
        if (!phone.trim()) { setFormError('请填写联系电话'); setErrorField('phone'); return; }

        // Final Submit
        setIsSubmitting(true);
        try {
            const result = await bookingApi.create({
                providerId: Number(provider.id), // Ensure numeric type for backend
                providerType: providerType,
                address,
                area: areaNum,
                renovationType,
                budgetRange: budget,
                preferredDate,
                phone: user?.phone || phone,
                notes,
                houseLayout: `${room}室${hall}厅${toilet}卫`
            });

            // 获取返回的预约信息
            const bookingData = result?.data || result;

            // 跳转到付款页面（使用 replace 避免返回到此页面）
            setTimeout(() => {
                navigation.replace('Payment', {
                    bookingId: bookingData.id,
                    amount: bookingData.intentFee || 99,
                    providerName: provider.name,
                });
            }, 2000);
        } catch (error: any) {
            console.error('Submit booking error:', error);
            const errorMessage = error.response?.data?.message || error.message || '请稍后重试';
            showAlert('预约失败', typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        } finally {
            setIsSubmitting(false);
        }
    };

    const areaNum = parseFloat(area);
    const isFormValid =
        address.trim().length >= 5 &&
        area.trim() !== '' && !isNaN(areaNum) && areaNum >= 10 && areaNum <= 9999 &&
        !!renovationType && !!budget && !!preferredDate && !!phone.trim();

    return (
        <SafeAreaView style={styles.container}>
            {/* Configure StatusBar */}
            <StatusBar
                barStyle="dark-content"
                backgroundColor="#FFFFFF"
                translucent={false} // Ensure it doesn't overlap on Android if we want that
            />

            {/* Header - Fixed to standard height with padding for status bar if needed */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} // Increased hitSlop
                >
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>预约服务</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.keyboardView}>
                {/*
                   Removed TouchableWithoutFeedback wrapper to fix scrolling issues.
                   Using ScrollView's keyboard props instead.
                */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    showsVerticalScrollIndicator={true}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                    bounces={true}
                    alwaysBounceVertical={true}
                    scrollEnabled={true}
                    onScrollBeginDrag={() => {
                        setShowBudgetDropdown(false);
                        Keyboard.dismiss();
                    }}
                >
                    {/* Provider Info Card */}
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

                    {/* Booking Form Card */}
                    <View style={styles.formCard}>
                        <Text style={styles.sectionTitle}>预约信息</Text>

                        {/* Address */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <MapPin size={16} color="#71717A" />
                                <Text style={styles.label}>房屋地址</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="请输入具体地址（街道/小区/门牌号）"
                                    placeholderTextColor="#A1A1AA"
                                    value={address}
                                    onChangeText={setAddress}
                                    onBlur={handleAddressBlur}
                                    maxLength={100}
                                    onFocus={() => setShowBudgetDropdown(false)}
                                />
                                <Text style={styles.counterText}>{address.length}/100</Text>
                            </View>
                            {errorField === 'address' && formError && (
                                <Text style={styles.errorText}>{formError}</Text>
                            )}
                        </View>

                        {/* Area & Layout (Row) */}
                        <View style={styles.rowContainer}>
                            <View style={[styles.formItem, { flex: 1, marginRight: 12 }]}>
                                <View style={styles.labelRow}>
                                    <Ruler size={16} color="#71717A" />
                                    <Text style={styles.label}>房屋面积</Text>
                                    <Text style={styles.required}>*</Text>
                                </View>
                                <View style={styles.inputContainer}>
                                    <View style={styles.inputWithUnit}>
                                        <TextInput
                                            style={[styles.input, styles.inputFlex]}
                                            placeholder="10-9999"
                                            placeholderTextColor="#A1A1AA"
                                            keyboardType="numeric"
                                            value={area}
                                            onChangeText={handleAreaChange}
                                            onBlur={handleAreaBlur}
                                            onFocus={() => setShowBudgetDropdown(false)}
                                        />
                                        <Text style={styles.unit}>㎡</Text>
                                    </View>
                                </View>
                                {errorField === 'area' && formError && (
                                    <Text style={styles.errorText}>{formError}</Text>
                                )}
                            </View>

                            <View style={[styles.formItem, { flex: 1 }]}>
                                <View style={styles.labelRow}>
                                    <Home size={16} color="#71717A" />
                                    <Text style={styles.label}>房屋户型</Text>
                                    <Text style={styles.required}>*</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.selectInput}
                                    onPress={() => {
                                        closeMenus();
                                        setShowLayoutPicker(true);
                                    }}
                                >
                                    <Text style={styles.selectText}>
                                        {`${room}室${hall}厅${toilet}卫`}
                                    </Text>
                                    <ChevronDown size={18} color="#71717A" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Renovation Type */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Home size={16} color="#71717A" />
                                <Text style={styles.label}>装修类型</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <View style={styles.tagContainer}>
                                {RENOVATION_TYPES.map((type) => (
                                    <TouchableOpacity
                                        key={type.id}
                                        style={[
                                            styles.tag,
                                            renovationType === type.id && styles.tagActive
                                        ]}
                                        onPress={() => {
                                            setRenovationType(type.id);
                                            if (errorField === 'renovationType') {
                                                setFormError(null);
                                                setErrorField(null);
                                            }
                                        }}
                                    >
                                        <Text style={[
                                            styles.tagText,
                                            renovationType === type.id && styles.tagTextActive
                                        ]}>{type.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {errorField === 'renovationType' && formError && (
                                <Text style={styles.errorText}>{formError}</Text>
                            )}
                        </View>

                        {/* Budget */}
                        <View style={[styles.formItem, { zIndex: showBudgetDropdown ? 100 : 1 }]}>
                            <View style={styles.labelRow}>
                                <DollarSign size={16} color="#71717A" />
                                <Text style={styles.label}>预算范围</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.selectInput, showBudgetDropdown && styles.selectInputActive]}
                                onPress={() => setShowBudgetDropdown(!showBudgetDropdown)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.selectText, !budget && styles.selectPlaceholder]}>
                                    {budget ? BUDGET_RANGES.find(b => b.id === budget)?.label : '请选择您的装修预算'}
                                </Text>
                                <ChevronDown
                                    size={18}
                                    color={showBudgetDropdown ? "#18181B" : "#71717A"}
                                    style={{ transform: [{ rotate: showBudgetDropdown ? '180deg' : '0deg' }] }}
                                />
                            </TouchableOpacity>

                            {/* Local Backdrop for Budget - Inside the high-z-index container */}
                            {showBudgetDropdown && (
                                <TouchableOpacity
                                    style={{
                                        position: 'absolute',
                                        top: -1000,
                                        left: -1000,
                                        width: 3000,
                                        height: 3000,
                                        zIndex: 10, // Below Dropdown
                                        // backgroundColor: 'rgba(0,0,0,0.1)', // Debug tint
                                    }}
                                    activeOpacity={1}
                                    onPress={() => setShowBudgetDropdown(false)}
                                />
                            )}

                            {/* Inline Dropdown Absolute Overlay */}
                            {showBudgetDropdown && (
                                <View style={[styles.dropdownContainer, { zIndex: 20 }]}>
                                    {BUDGET_RANGES.map((item, index) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[
                                                styles.dropdownItem,
                                                index === BUDGET_RANGES.length - 1 && styles.dropdownItemLast,
                                                budget === item.id && styles.dropdownItemActive
                                            ]}
                                            onPress={() => {
                                                setBudget(item.id);
                                                setShowBudgetDropdown(false);
                                                if (errorField === 'budget') {
                                                    setFormError(null);
                                                    setErrorField(null);
                                                }
                                            }}
                                        >
                                            <Text style={[
                                                styles.dropdownItemText,
                                                budget === item.id && styles.dropdownItemTextActive
                                            ]}>
                                                {item.label}
                                            </Text>
                                            {budget === item.id && <Check size={16} color="#18181B" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                            {errorField === 'budget' && formError && (
                                <Text style={styles.errorText}>{formError}</Text>
                            )}
                        </View>

                        {/* Preferred Date */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Calendar size={16} color="#71717A" />
                                <Text style={styles.label}>期望上门时间</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.selectInput}
                                onPress={() => {
                                    closeMenus();
                                    setShowDatePicker(true);
                                }}
                            >
                                <Text style={[styles.selectText, !preferredDate && styles.selectPlaceholder]}>
                                    {preferredDate || '请选择期望上门时间'}
                                </Text>
                                <ChevronDown size={18} color="#71717A" />
                            </TouchableOpacity>
                            {errorField === 'preferredDate' && formError && (
                                <Text style={styles.errorText}>{formError}</Text>
                            )}
                        </View>

                        {/* Phone */}
                        <View style={styles.formItem}>
                            <View style={styles.labelRow}>
                                <Phone size={16} color="#71717A" />
                                <Text style={styles.label}>联系电话</Text>
                                <Text style={styles.required}>*</Text>
                            </View>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={[styles.input, styles.disabledInput]}
                                    value={maskPhone(user?.phone || phone)}
                                    editable={false}
                                />
                            </View>
                        </View>

                        {/* Notes */}
                        <View style={[styles.formItem, { borderBottomWidth: 0, marginBottom: 0 }]}>
                            <View style={styles.labelRow}>
                                <FileText size={16} color="#71717A" />
                                <Text style={styles.label}>备注信息</Text>
                            </View>
                            <View style={[styles.inputContainer, { height: 'auto' }]}>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="请描述您的具体需求，如：风格偏好、特殊要求等..."
                                    placeholderTextColor="#A1A1AA"
                                    multiline
                                    numberOfLines={4}
                                    value={notes}
                                    onChangeText={setNotes}
                                    onFocus={() => setShowBudgetDropdown(false)}
                                />
                                <Text style={styles.charCount}>{notes.length}/500</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* Footer - Refined */}
            <View style={styles.footer}>
                <View style={styles.feeInfo}>
                    <Text style={styles.feeLabel}>定金</Text>
                    <Text style={styles.currencySymbol}>¥</Text>
                    <Text style={styles.feeAmount}>99</Text>
                    <Text style={styles.feeNote}>(可抵扣设计费)</Text>
                </View>
                <TouchableOpacity
                    style={[styles.submitBtn, (!isFormValid || isSubmitting) && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!isFormValid || isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitBtnText}>确认预约</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modals (Layout, Budget, Date, Success) */}
            {/* Same logic, just ensuring they render */}

            <LayoutPickerModal
                visible={showLayoutPicker}
                onClose={() => setShowLayoutPicker(false)}
                room={room} setRoom={setRoom}
                hall={hall} setHall={setHall}
                toilet={toilet} setToilet={setToilet}
                roomOptions={ROOM_OPTIONS}
                hallOptions={HALL_OPTIONS}
                toiletOptions={TOILET_OPTIONS}
            />

            <DateTimePickerModal
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                weekDays={weekDays}
                timeSlots={TIME_SLOTS}
                onConfirm={(dateLabel, timeLabel) => {
                    setPreferredDate(`${dateLabel} ${timeLabel}`);
                    setShowDatePicker(false);
                    if (errorField === 'preferredDate') {
                        setFormError(null);
                        setErrorField(null);
                    }
                }}
            />

            <SuccessModal
                visible={showSuccessModal}
                onClose={() => { setShowSuccessModal(false); navigation.goBack(); }}
            />

        </SafeAreaView>
    );
};

// --- Sub Components ---

// Reusable Selection Modal
interface SelectionModalProps {
    visible: boolean;
    title: string;
    options: { id: string; label: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
}

const SelectionModal = ({ visible, title, options, selectedId, onSelect, onClose }: SelectionModalProps) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
            <View style={[styles.modalContent, { height: 'auto', paddingBottom: 30 }]}>
                <Text style={styles.modalTitle}>{title}</Text>
                <ScrollView style={{ maxHeight: 300 }}>
                    {options.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.modalOption}
                            onPress={() => onSelect(item.id)}
                        >
                            <Text style={[styles.modalOptionText, selectedId === item.id && styles.activeText]}>
                                {item.label}
                            </Text>
                            {selectedId === item.id && <Check size={20} color="#09090B" />}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </TouchableOpacity>
    </Modal>
);

const LayoutPickerModal = ({ visible, onClose, room, setRoom, hall, setHall, toilet, setToilet, roomOptions, hallOptions, toiletOptions }: any) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>选择户型</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <X size={24} color="#666" />
                    </TouchableOpacity>
                </View>
                <View style={styles.pickerContainer}>
                    <View style={styles.pickerColumn}>
                        <Text style={styles.pickerLabel}>室</Text>
                        <ScrollView style={styles.pickerList}>
                            {roomOptions.map((num: number) => (
                                <TouchableOpacity
                                    key={`room-${num}`}
                                    style={[styles.pickerItem, room === num && styles.pickerItemActive]}
                                    onPress={() => setRoom(num)}
                                >
                                    <Text style={[styles.pickerItemText, room === num && styles.pickerItemTextActive]}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                    <View style={styles.pickerColumn}>
                        <Text style={styles.pickerLabel}>厅</Text>
                        <ScrollView style={styles.pickerList}>
                            {hallOptions.map((num: number) => (
                                <TouchableOpacity
                                    key={`hall-${num}`}
                                    style={[styles.pickerItem, hall === num && styles.pickerItemActive]}
                                    onPress={() => setHall(num)}
                                >
                                    <Text style={[styles.pickerItemText, hall === num && styles.pickerItemTextActive]}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                    <View style={styles.pickerColumn}>
                        <Text style={styles.pickerLabel}>卫</Text>
                        <ScrollView style={styles.pickerList}>
                            {toiletOptions.map((num: number) => (
                                <TouchableOpacity
                                    key={`toilet-${num}`}
                                    style={[styles.pickerItem, toilet === num && styles.pickerItemActive]}
                                    onPress={() => setToilet(num)}
                                >
                                    <Text style={[styles.pickerItemText, toilet === num && styles.pickerItemTextActive]}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={onClose}>
                    <Text style={styles.modalConfirmBtnText}>确定</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    </Modal>
);

interface DateTimePickerModalProps {
    visible: boolean;
    onClose: () => void;
    weekDays: WeekDay[];
    timeSlots: { id: string; label: string }[];
    onConfirm: (date: string, time: string) => void;
}

const DateTimePickerModal = ({ visible, onClose, weekDays, timeSlots, onConfirm }: DateTimePickerModalProps) => {
    const [selectedDayId, setSelectedDayId] = useState(weekDays[0]?.id);
    const [selectedTimeId, setSelectedTimeId] = useState(timeSlots[0]?.id);

    // Update simple temp state when visible changes (optional, but good for UX to reset or keep)
    // For now, simpler implementation:

    const handleConfirm = () => {
        const day = weekDays.find((d: WeekDay) => d.id === selectedDayId);
        const time = timeSlots.find((t: { id: string; label: string }) => t.id === selectedTimeId);
        if (day && time) {
            onConfirm(day.fullDate, time.label.split(' ')[0]);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
                    <View style={styles.pickerHeader}>
                        <TouchableOpacity onPress={onClose}><Text style={styles.pickerCancelText}>取消</Text></TouchableOpacity>
                        <Text style={styles.pickerTitle}>选择上门时间</Text>
                        <TouchableOpacity onPress={handleConfirm}><Text style={styles.pickerConfirmText}>确定</Text></TouchableOpacity>
                    </View>

                    <View style={styles.pickerBody}>
                        {/* Left Column: Date */}
                        <View style={styles.pickerColumnLeft}>
                            <Text style={styles.columnTitle}>日期</Text>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {weekDays.map((day: WeekDay) => (
                                    <TouchableOpacity
                                        key={day.id}
                                        style={[styles.datePickerItem, selectedDayId === day.id && styles.datePickerItemActive]}
                                        onPress={() => setSelectedDayId(day.id)}
                                    >
                                        <Text style={[styles.datePickerItemText, selectedDayId === day.id && styles.datePickerItemTextActive]}>
                                            {day.fullDate}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Right Column: Time */}
                        <View style={styles.pickerColumnRight}>
                            <Text style={styles.columnTitle}>时间段</Text>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {timeSlots.map((time: { id: string; label: string }) => (
                                    <TouchableOpacity
                                        key={time.id}
                                        style={[styles.datePickerItem, selectedTimeId === time.id && styles.datePickerItemActive]}
                                        onPress={() => setSelectedTimeId(time.id)}
                                    >
                                        <Text style={[styles.datePickerItemText, selectedTimeId === time.id && styles.datePickerItemTextActive]}>
                                            {time.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const SuccessModal = ({ visible, onClose }: any) => {
    const [scaleAnim] = React.useState(new Animated.Value(0));
    const [opacityAnim] = React.useState(new Animated.Value(0));

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={styles.successOverlay}>
                <Animated.View style={[
                    styles.successCard,
                    { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
                ]}>
                    <View style={styles.successIconContainer}>
                        <CheckCircle size={60} color="#52c41a" fill="#f6ffed" />
                    </View>
                    <Text style={styles.successTitle}>预约成功</Text>
                    <Text style={styles.successSubTitle}>我们已收到您的预约请求{'\n'}设计师将尽快与您联系</Text>
                    <TouchableOpacity style={styles.successBtn} onPress={onClose}>
                        <Text style={styles.successBtnText}>我知道了</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        height: 56,
        backgroundColor: '#FFFFFF',
        zIndex: 10,
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        zIndex: 20,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 40,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 12,
        paddingTop: 12,
    },

    // Provider Card
    providerCard: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        alignItems: 'center',
    },
    providerAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#F4F4F5',
    },
    providerInfo: {
        marginLeft: 16,
        justifyContent: 'center',
        flex: 1,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    providerName: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
        color: '#09090B',
    },
    typeBadge: {
        backgroundColor: '#F4F4F5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginLeft: 10,
    },
    typeBadgeText: {
        fontSize: 11,
        color: '#52525B',
        fontWeight: '500',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    ratingText: {
        fontSize: 13,
        color: '#71717A',
        marginLeft: 6,
        fontWeight: '500',
    },
    providerSubtitle: {
        fontSize: 13,
        color: '#A1A1AA',
    },

    // Form
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#09090B',
    },
    formItem: {
        marginBottom: 24,
    },
    rowContainer: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    label: {
        fontSize: 14,
        color: '#71717A',
        marginLeft: 8,
        fontWeight: '500',
    },
    required: {
        fontSize: 14,
        color: '#EF4444',
        marginLeft: 4,
    },

    // Inputs
    inputContainer: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        overflow: 'hidden',
    },
    input: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#09090B',
    },
    inputFlex: {
        flex: 1,
    },
    inputWithUnit: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    unit: {
        fontSize: 14,
        color: '#71717A',
        paddingRight: 16,
    },
    disabledInput: {
        backgroundColor: '#F4F4F5',
        color: '#A1A1AA',
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
        paddingTop: 16,
    },
    counterText: {
        fontSize: 12,
        color: '#A1A1AA',
        textAlign: 'right',
        marginTop: 4,
        marginRight: 8,
    },
    charCount: {
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 12,
        color: '#A1A1AA',
    },
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 6,
        marginLeft: 4,
    },

    // Selectors
    selectInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    selectText: {
        fontSize: 15,
        color: '#09090B',
    },
    selectPlaceholder: {
        color: '#A1A1AA',
    },

    // Tags - Single Row
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'space-between',
    },
    tag: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        borderWidth: 1,
        borderColor: '#E4E4E7',
        marginHorizontal: 4,
        alignItems: 'center',
    },
    tagActive: {
        backgroundColor: '#18181B',
        borderColor: '#18181B',
    },
    tagText: {
        fontSize: 14,
        color: '#71717A',
    },
    tagTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },

    // Footer - Floating Look
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 30 : 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Shadow to float
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 12,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    feeInfo: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flex: 1,
    },
    feeLabel: {
        fontSize: 14,
        color: '#52525B',
        marginRight: 4,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    currencySymbol: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#F59E0B',
        marginRight: 2,
    },
    feeAmount: {
        fontSize: 28,
        fontWeight: '800', // Extra bold
        color: '#F59E0B',
        fontFamily: Platform.OS === 'ios' ? 'DIN Alternate' : 'Roboto', // Numerical font preference
        marginRight: 6,
    },
    feeNote: {
        fontSize: 11,
        color: '#A1A1AA',
    },
    submitBtn: {
        backgroundColor: '#09090B',
        borderRadius: 28, // Pill shape
        paddingVertical: 14,
        paddingHorizontal: 36,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#09090B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#E4E4E7',
        shadowOpacity: 0,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#09090B',
        textAlign: 'center',
    },
    activeText: {
        color: '#09090B',
        fontWeight: 'bold',
    },
    pickerContainer: {
        flexDirection: 'row',
        height: 250,
    },
    pickerColumn: {
        flex: 1,
        alignItems: 'center',
        height: '100%',
        borderRightWidth: 1,
        borderRightColor: '#F4F4F5',
    },
    pickerLabel: {
        fontSize: 14,
        color: '#71717A',
        paddingVertical: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    pickerList: {
        width: '100%',
    },
    pickerItem: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    pickerItemActive: {
        backgroundColor: '#F4F4F5',
    },
    pickerItemText: {
        fontSize: 16,
        color: '#71717A',
    },
    pickerItemTextActive: {
        color: '#09090B',
        fontWeight: '600',
    },
    modalConfirmBtn: {
        margin: 16,
        backgroundColor: '#09090B',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalConfirmBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    modalOptionText: {
        fontSize: 16,
        color: '#333',
    },
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    successCard: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        maxWidth: 320,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
    },
    successIconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    successTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#09090B',
        marginBottom: 12,
    },
    successSubTitle: {
        fontSize: 15,
        color: '#71717A',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
    },
    successBtn: {
        backgroundColor: '#09090B',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
    },
    successBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    // --- New Styles for Dropdown & Split Picker ---
    selectInputActive: {
        borderColor: '#18181B',
        backgroundColor: '#FFFFFF',
    },
    dropdownContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 999,
        paddingVertical: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    dropdownItemLast: {
        borderBottomWidth: 0,
    },
    dropdownItemActive: {
        backgroundColor: '#F4F4F5',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#52525B',
    },
    dropdownItemTextActive: {
        color: '#18181B',
        fontWeight: '600',
    },

    // Split Picker Styles
    pickerModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        width: '100%',
        height: 320, // Reduced from 500
        paddingBottom: 34,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#18181B',
    },
    pickerCancelText: {
        fontSize: 14,
        color: '#71717A',
    },
    pickerConfirmText: {
        fontSize: 14,
        color: '#18181B',
        fontWeight: '600',
    },
    pickerBody: {
        flex: 1,
        flexDirection: 'row',
    },
    pickerColumnLeft: {
        flex: 1.4, // Increased from 1
        borderRightWidth: 1,
        borderRightColor: '#F4F4F5',
        backgroundColor: '#F8F9FA',
    },
    pickerColumnRight: {
        flex: 2, // Reduced from 3
        backgroundColor: '#FFFFFF',
    },
    columnTitle: {
        fontSize: 12,
        color: '#A1A1AA',
        padding: 12,
        textAlign: 'center',
    },
    datePickerItem: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    datePickerItemActive: {
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 3,
        borderLeftColor: '#18181B', // For left column
    },
    datePickerItemText: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
    },
    datePickerItemTextActive: {
        color: '#18181B',
        fontWeight: '600',
    },
});

export default BookingScreen;
