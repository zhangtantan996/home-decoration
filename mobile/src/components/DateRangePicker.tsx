import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Dimensions,
    Platform,
    FlatList,
    Modal,
    SafeAreaView,
} from 'react-native';
import { Calendar, ChevronRight, X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DateRange {
    start: Date | null;
    end: Date | null;
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    minDate?: Date;
    maxDate?: Date;
    placeholder?: { start: string; end: string };
}

const DAYS = ['日', '一', '二', '三', '四', '五', '六'];

const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date: Date | null): string => {
    if (!date) return '';
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({
    value,
    onChange,
    minDate = new Date(),
    maxDate,
    placeholder = { start: '选择开始日期', end: '选择结束日期' },
}) => {
    const [visible, setVisible] = useState(false);
    const [tempRange, setTempRange] = useState<DateRange>(value);

    // Use useRef properly to avoid recreation on re-renders
    const fadeAnim = useRef(new Animated.Value(0)).current;
    // Start from screen height (off-screen)
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const monthList = useMemo(() => {
        const months: Date[] = [];
        const today = new Date();
        today.setDate(1);

        for (let i = 0; i < 12; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            months.push(date);
        }
        return months;
    }, []);

    const openModal = useCallback(() => {
        setTempRange(value);
        setVisible(true);
        // Delay animation slightly to ensure Modal is mounted and ready
        requestAnimationFrame(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    }, [value, fadeAnim, slideAnim]);

    const closeModal = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => setVisible(false));
    }, [fadeAnim, slideAnim]);

    const handleConfirm = () => {
        if (tempRange.start && tempRange.end) {
            onChange(tempRange);
            closeModal();
        }
    };

    const handleDayPress = (day: Date) => {
        if (!tempRange.start || (tempRange.start && tempRange.end)) {
            setTempRange({ start: day, end: null });
        } else {
            if (day < tempRange.start) {
                setTempRange({ start: day, end: tempRange.start });
            } else {
                setTempRange({ start: tempRange.start, end: day });
            }
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const days: (Date | null)[] = [];
        for (let i = 0; i < startingDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const isDisabled = (day: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (day < today) return true;
        if (minDate && day < minDate) return true;
        if (maxDate && day > maxDate) return true;
        return false;
    };

    const isStart = (day: Date) => tempRange.start && day.toDateString() === tempRange.start?.toDateString();
    const isEnd = (day: Date) => tempRange.end && day.toDateString() === tempRange.end?.toDateString();
    const isInRange = (day: Date) => {
        if (!tempRange.start || !tempRange.end) return false;
        return day > tempRange.start && day < tempRange.end;
    };
    const isToday = (day: Date) => day.toDateString() === new Date().toDateString();

    const renderMonthItem = ({ item: monthDate }: { item: Date }) => {
        const days = getDaysInMonth(monthDate);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;

        return (
            <View style={styles.monthContainer}>
                <Text style={styles.monthTitle}>{year}年 {month}月</Text>
                <View style={styles.daysGrid}>
                    {days.map((day, index) => {
                        if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
                        const disabled = isDisabled(day);
                        const start = isStart(day);
                        const end = isEnd(day);
                        const inRange = isInRange(day);
                        const today = isToday(day);

                        return (
                            <TouchableOpacity
                                key={day.getDate()}
                                style={styles.dayCell}
                                onPress={() => !disabled && handleDayPress(day)}
                                disabled={disabled}
                                activeOpacity={0.7}
                            >
                                {(start || end || inRange) && (
                                    <View style={[
                                        styles.rangeBackgroundBase,
                                        inRange && styles.dayInRange,
                                        start && styles.dayStartRange,
                                        end && styles.dayEndRange
                                    ]} />
                                )}
                                <View style={[
                                    styles.dayContent,
                                    (start || end) && styles.dayContentSelected,
                                    today && !start && !end && styles.dayContentToday
                                ]}>
                                    <Text style={[
                                        styles.dayText,
                                        disabled && styles.dayTextDisabled,
                                        (start || end) && styles.dayTextSelected,
                                        inRange && !start && !end && styles.dayTextInRange,
                                        today && !start && !end && styles.dayTextToday
                                    ]}>
                                        {day.getDate()}
                                    </Text>
                                    {start && <Text style={styles.labelParams}>起</Text>}
                                    {end && <Text style={styles.labelParams}>止</Text>}
                                    {today && !start && !end && <Text style={styles.labelToday}>今天</Text>}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderModalContent = () => (
        <View style={styles.contentWrapper}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>选择进场时间范围</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                    <X size={24} color="#71717A" />
                </TouchableOpacity>
            </View>

            <View style={styles.selectionDisplay}>
                <View style={styles.selectionItem}>
                    <Text style={styles.selectionLabel}>开始日期</Text>
                    <Text style={[styles.selectionValue, tempRange.start && styles.valueActive]}>
                        {tempRange.start ? formatDisplayDate(tempRange.start) : '请选择'}
                    </Text>
                </View>
                <ChevronRight size={20} color="#E4E4E7" />
                <View style={styles.selectionItem}>
                    <Text style={styles.selectionLabel}>结束日期</Text>
                    <Text style={[styles.selectionValue, tempRange.end && styles.valueActive]}>
                        {tempRange.end ? formatDisplayDate(tempRange.end) : '请选择'}
                    </Text>
                </View>
            </View>

            <View style={styles.weekRow}>
                {DAYS.map((day, index) => (
                    <Text key={index} style={[
                        styles.weekText,
                        (index === 0 || index === 6) && styles.weekendText
                    ]}>
                        {day}
                    </Text>
                ))}
            </View>

            <FlatList
                data={monthList}
                renderItem={renderMonthItem}
                keyExtractor={(item) => item.toDateString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={2}
                style={styles.flatList}
            />

            <SafeAreaView style={styles.footerSafe}>
                <View style={styles.modalFooter}>
                    <TouchableOpacity
                        style={[
                            styles.confirmButton,
                            (!tempRange.start || !tempRange.end) && styles.confirmButtonDisabled,
                        ]}
                        onPress={handleConfirm}
                        disabled={!tempRange.start || !tempRange.end}
                    >
                        <Text style={styles.confirmText}>
                            {tempRange.start && tempRange.end
                                ? `确认选择 (${Math.ceil((tempRange.end.getTime() - tempRange.start.getTime()) / (86400000)) + 1}天)`
                                : '确认选择'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );

    return (
        <>
            <TouchableOpacity style={styles.triggerContainer} onPress={openModal}>
                <View style={styles.triggerContent}>
                    <View style={styles.triggerItem}>
                        <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
                            <Calendar size={18} color="#059669" />
                        </View>
                        <View>
                            <Text style={styles.triggerLabel}>最早进场</Text>
                            <Text style={[styles.triggerValue, !value.start && styles.triggerPlaceholder]}>
                                {value.start ? formatDisplayDate(value.start) : placeholder.start}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.connectorLine} />
                    <View style={styles.triggerItem}>
                        <View style={[styles.iconBox, { backgroundColor: '#FFFBEB' }]}>
                            <Calendar size={18} color="#D97706" />
                        </View>
                        <View>
                            <Text style={styles.triggerLabel}>最晚进场</Text>
                            <Text style={[styles.triggerValue, !value.end && styles.triggerPlaceholder]}>
                                {value.end ? formatDisplayDate(value.end) : placeholder.end}
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>

            <Modal
                transparent
                visible={visible}
                onRequestClose={closeModal}
                animationType="none"
                statusBarTranslucent
            >
                <View style={styles.modalOverlay}>
                    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} />
                    </Animated.View>

                    <Animated.View style={[
                        styles.modalContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}>
                        {Platform.OS === 'ios' ? (
                            <BlurView intensity={80} tint="light" style={styles.blurContent}>
                                {renderModalContent()}
                            </BlurView>
                        ) : (
                            <View style={styles.androidContent}>
                                {renderModalContent()}
                            </View>
                        )}
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    triggerContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    triggerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    triggerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    triggerLabel: {
        fontSize: 12,
        color: '#71717A',
        marginBottom: 2,
    },
    triggerValue: {
        fontSize: 15,
        fontWeight: '600',
        color: '#09090B',
    },
    triggerPlaceholder: {
        color: '#A1A1AA',
        fontWeight: '400',
        fontSize: 14,
    },
    connectorLine: {
        width: 12,
        height: 1,
        backgroundColor: '#E4E4E7',
        marginHorizontal: 16,
    },

    // Modal & Overlay
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalContainer: {
        height: '85%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    blurContent: {
        flex: 1,
    },
    androidContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    contentWrapper: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
    },

    // Header & Controls
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#09090B',
    },
    closeButton: {
        padding: 4,
        backgroundColor: '#F4F4F5',
        borderRadius: 12,
    },

    selectionDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 20,
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        marginBottom: 16,
    },
    selectionItem: {
        alignItems: 'center',
        flex: 1,
    },
    selectionLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
    },
    selectionValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94A3B8',
    },
    valueActive: {
        color: '#0F172A',
    },

    // Calendar List
    weekRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    weekText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    weekendText: {
        color: '#F43F5E',
    },
    flatList: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 20,
    },

    monthContainer: {
        paddingTop: 24,
        paddingBottom: 8,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginLeft: 20,
        marginBottom: 16,
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 12,
    },
    dayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },

    // Range Visuals
    rangeBackgroundBase: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    dayInRange: {
        backgroundColor: '#ECFDF5',
        marginLeft: -1,
        marginRight: -1,
        width: '120%',
        left: '-10%',
    },
    dayStartRange: {
        borderTopLeftRadius: 50,
        borderBottomLeftRadius: 50,
        marginLeft: 4,
        width: '100%',
        left: 0,
    },
    dayEndRange: {
        borderTopRightRadius: 50,
        borderBottomRightRadius: 50,
        marginRight: 4,
        width: '100%',
        left: 0,
    },

    dayContent: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    dayContentSelected: {
        backgroundColor: '#0F172A',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    dayContentToday: {
        borderWidth: 1,
        borderColor: '#10B981',
    },

    dayText: {
        fontSize: 15,
        color: '#334155',
        fontWeight: '500',
    },
    dayTextDisabled: {
        color: '#CBD5E1',
    },
    dayTextSelected: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 2,
    },
    dayTextInRange: {
        color: '#059669',
        fontWeight: '600',
    },
    dayTextToday: {
        color: '#10B981',
        fontWeight: '600',
    },

    // Labels
    labelParams: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 10,
        position: 'absolute',
        bottom: 3,
    },
    labelToday: {
        fontSize: 8,
        color: '#10B981',
        position: 'absolute',
        bottom: 2,
    },

    // Footer
    footerSafe: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    modalFooter: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'android' ? 20 : 0,
    },
    confirmButton: {
        backgroundColor: '#0F172A',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    confirmButtonDisabled: {
        backgroundColor: '#E2E8F0',
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default DateRangePicker;
export { formatDate };
export type { DateRange };
