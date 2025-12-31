import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    Check,
    Hammer,
    Truck,
    ChevronRight,
} from 'lucide-react-native';
import { projectApi } from '../services/api';
import DateRangePicker, { DateRange, formatDate } from '../components/DateRangePicker';
import InfoModal from '../components/InfoModal';

interface CreateProjectScreenProps {
    route: any;
    navigation: any;
}

const STEPS = ['选材方式', '施工团队', '进场时间'];

const CreateProjectScreen: React.FC<CreateProjectScreenProps> = ({ route, navigation }) => {
    const { proposalId } = route.params;

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Form State
    const [materialMethod, setMaterialMethod] = useState<'self' | 'platform' | null>(null);
    const [selectedCrew, setSelectedCrew] = useState<number | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

    // Modal State
    const [modalConfig, setModalConfig] = useState({
        visible: false,
        type: 'info' as 'success' | 'error' | 'info',
        title: '',
        message: '',
        buttonText: '知道了',
        onConfirm: () => { },
    });

    // Mock Crews (Initial, will be replaced by API later)
    const CREWS = [
        { id: 1, name: '金牌施工队 A组', rating: 4.9, completed: 128 },
        { id: 2, name: '专业施工队 B组', rating: 4.8, completed: 96 },
        { id: 3, name: '精品施工队 C组', rating: 4.7, completed: 85 },
    ];

    const showTip = (msg: string) => {
        setModalConfig({
            visible: true,
            type: 'info',
            title: '提示',
            message: msg,
            buttonText: '知道了',
            onConfirm: () => { },
        });
    };

    const showError = (msg: string) => {
        setModalConfig({
            visible: true,
            type: 'error',
            title: '创建失败',
            message: msg,
            buttonText: '重试',
            onConfirm: () => { },
        });
    };

    const showSuccess = (title: string, msg: string, onOk: () => void) => {
        setModalConfig({
            visible: true,
            type: 'success',
            title,
            message: msg,
            buttonText: '前往项目详情',
            onConfirm: onOk,
        });
    };

    const handleModalClose = () => {
        setModalConfig(prev => ({ ...prev, visible: false }));
        // Execute the confirm action (e.g., navigation)
        const action = modalConfig.onConfirm;
        if (action) {
            // Small delay to allow modal exit animation to start if needed, 
            // but for navigation it's better to just go.
            action();
        }
    };

    const handleNext = () => {
        if (currentStep === 0 && !materialMethod) {
            showTip('请选择选材方式');
            return;
        }
        if (currentStep === 1 && !selectedCrew) {
            showTip('请选择施工团队');
            return;
        }
        if (currentStep === 2) {
            if (!dateRange.start || !dateRange.end) {
                showTip('请选择进场时间范围');
                return;
            }
            createProject();
            return;
        }
        setCurrentStep((prev) => prev + 1);
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const createProject = async () => {
        try {
            setLoading(true);
            const data = {
                proposalId,
                materialMethod,
                crewId: selectedCrew,
                entryStartDate: dateRange.start ? formatDate(dateRange.start) : '',
                entryEndDate: dateRange.end ? formatDate(dateRange.end) : '',
            };

            const res = await projectApi.create(data);

            showSuccess(
                '创建成功',
                '您的装修项目已正式立项！',
                () => {
                    navigation.replace('ProjectDetail', { projectId: res.data.id });
                }
            );
        } catch (error: any) {
            showError(error.message || '请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>选择材料采购方式</Text>
                        <TouchableOpacity
                            style={[
                                styles.optionCard,
                                materialMethod === 'platform' && styles.optionCardActive,
                            ]}
                            onPress={() => setMaterialMethod('platform')}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: '#ECFDF5' }]}>
                                <Truck size={24} color="#059669" />
                            </View>
                            <View style={styles.optionContent}>
                                <Text style={styles.optionTitle}>平台代购 (推荐)</Text>
                                <Text style={styles.optionDesc}>
                                    专业采购团队，正品保证，低于市场价，配送安装一站式服务
                                </Text>
                            </View>
                            {materialMethod === 'platform' && (
                                <Check size={20} color="#059669" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.optionCard,
                                materialMethod === 'self' && styles.optionCardActive,
                            ]}
                            onPress={() => setMaterialMethod('self')}
                        >
                            <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
                                <Hammer size={24} color="#2563EB" />
                            </View>
                            <View style={styles.optionContent}>
                                <Text style={styles.optionTitle}>业主自购</Text>
                                <Text style={styles.optionDesc}>
                                    自行购买主材，需自行协调送货安装时间，平台仅负责施工辅材
                                </Text>
                            </View>
                            {materialMethod === 'self' && (
                                <Check size={20} color="#2563EB" />
                            )}
                        </TouchableOpacity>
                    </View>
                );
            case 1:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>选择施工团队</Text>
                        <Text style={styles.stepSubtitle}>根据您的预算和工期推荐</Text>

                        {CREWS.map((crew) => (
                            <TouchableOpacity
                                key={crew.id}
                                style={[
                                    styles.optionCard,
                                    selectedCrew === crew.id && styles.optionCardActive,
                                ]}
                                onPress={() => setSelectedCrew(crew.id)}
                            >
                                <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
                                    <Hammer size={24} color="#D97706" />
                                </View>
                                <View style={styles.optionContent}>
                                    <Text style={styles.optionTitle}>{crew.name}</Text>
                                    <Text style={styles.optionDesc}>
                                        评分 {crew.rating} · 已完工 {crew.completed} 套
                                    </Text>
                                </View>
                                {selectedCrew === crew.id && (
                                    <Check size={20} color="#D97706" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            case 2:
                return (
                    <View style={styles.stepContainer}>
                        <Text style={styles.stepTitle}>确认进场时间</Text>
                        <Text style={styles.stepSubtitle}>请选择期望的施工进场日期范围</Text>

                        <DateRangePicker
                            value={dateRange}
                            onChange={setDateRange}
                            placeholder={{ start: '选择开始日期', end: '选择结束日期' }}
                        />

                        <View style={styles.tipContainer}>
                            <Text style={styles.tipText}>
                                提示：实际进场时间将在此范围内，并需与施工队最终确认。
                            </Text>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>创建项目</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                {STEPS.map((step, index) => (
                    <React.Fragment key={index}>
                        <View style={styles.stepWrapper}>
                            <View
                                style={[
                                    styles.stepDot,
                                    index <= currentStep && styles.stepDotActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.stepNumber,
                                        index <= currentStep && styles.stepNumberActive,
                                    ]}
                                >
                                    {index + 1}
                                </Text>
                            </View>
                            <Text
                                style={[
                                    styles.stepLabel,
                                    index <= currentStep && styles.stepLabelActive,
                                ]}
                            >
                                {step}
                            </Text>
                        </View>
                        {index < STEPS.length - 1 && (
                            <View
                                style={[
                                    styles.stepLine,
                                    index < currentStep && styles.stepLineActive,
                                ]}
                            />
                        )}
                    </React.Fragment>
                ))}
            </View>

            <ScrollView style={styles.content}>
                {renderStepContent()}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.footerButtons}>
                    {currentStep > 0 && (
                        <TouchableOpacity
                            style={styles.prevBtn}
                            onPress={handlePrev}
                            disabled={loading}
                        >
                            <Text style={styles.prevBtnText}>上一步</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.nextBtn, loading && styles.nextBtnDisabled]}
                        onPress={handleNext}
                        disabled={loading}
                    >
                        <Text style={styles.nextBtnText}>
                            {currentStep === STEPS.length - 1 ? (loading ? '创建中...' : '确认创建') : '下一步'}
                        </Text>
                        {currentStep < STEPS.length - 1 && (
                            <ChevronRight size={20} color="#FFFFFF" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Global Info Modal */}
            <InfoModal
                visible={modalConfig.visible}
                type={modalConfig.type}
                title={modalConfig.title}
                message={modalConfig.message}
                buttonText={modalConfig.buttonText}
                onClose={handleModalClose}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F4F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'android' ? 44 : 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E4E4E7',
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 40,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        paddingHorizontal: 32,
        backgroundColor: '#FFFFFF',
    },
    stepWrapper: {
        alignItems: 'center',
    },
    stepDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    stepDotActive: {
        backgroundColor: '#09090B',
    },
    stepNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: '#A1A1AA',
    },
    stepNumberActive: {
        color: '#FFFFFF',
    },
    stepLabel: {
        fontSize: 12,
        color: '#A1A1AA',
    },
    stepLabelActive: {
        color: '#09090B',
        fontWeight: '500',
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#F4F4F5',
        marginHorizontal: 8,
        marginBottom: 20,
    },
    stepLineActive: {
        backgroundColor: '#09090B',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    stepContainer: {
        gap: 16,
    },
    stepTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 4,
    },
    stepSubtitle: {
        fontSize: 14,
        color: '#71717A',
        marginBottom: 16,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionCardActive: {
        borderColor: '#09090B',
        backgroundColor: '#FAFAFA',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    optionContent: {
        flex: 1,
        marginRight: 12,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 4,
    },
    optionDesc: {
        fontSize: 12,
        color: '#71717A',
        lineHeight: 18,
    },
    tipContainer: {
        padding: 12,
        backgroundColor: '#FFFBEB',
        borderRadius: 8,
        marginTop: 8,
    },
    tipText: {
        fontSize: 12,
        color: '#D97706',
    },
    footer: {
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E4E4E7',
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    prevBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F4F4F5',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    prevBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#71717A',
    },
    nextBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#09090B',
        paddingVertical: 16,
        borderRadius: 12,
    },
    nextBtnDisabled: {
        backgroundColor: '#A1A1AA',
    },
    nextBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginRight: 4,
    },
});

export default CreateProjectScreen;
