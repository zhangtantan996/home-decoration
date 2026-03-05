import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import {
    ArrowLeft,
    Wrench,
    FileText,
    Lightbulb,
    MoreHorizontal,
    Image as ImageIcon,
    Plus,
    X,
    Phone,
    Send,
    CheckCircle,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

type FeedbackType = 'bug' | 'content' | 'suggestion' | 'other';

interface FeedbackScreenProps {
    navigation: any;
}

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { id: 'bug', label: '功能问题', icon: <Wrench size={16} color="#EF4444" />, color: '#EF4444', bg: '#FFF5F5' },
    { id: 'content', label: '内容问题', icon: <FileText size={16} color="#F97316" />, color: '#F97316', bg: '#FFF7ED' },
    { id: 'suggestion', label: '改进建议', icon: <Lightbulb size={16} color="#22C55E" />, color: '#22C55E', bg: '#F0FDF4' },
    { id: 'other', label: '其他', icon: <MoreHorizontal size={16} color="#71717A" />, color: '#71717A', bg: '#F4F4F5' },
];

const MAX_CHARS = 500;
const MAX_IMAGES = 3;

const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [type, setType] = useState<FeedbackType | null>(null);
    const [content, setContent] = useState('');
    const [contact, setContact] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleAddImage = () => {
        if (images.length >= MAX_IMAGES) {
            showAlert('提示', `最多上传 ${MAX_IMAGES} 张图片`);
            return;
        }
        // 模拟添加图片
        setImages(prev => [...prev, `placeholder_${Date.now()}`]);
        showAlert('提示', '图片已选取（模拟）');
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const canSubmit = type !== null && content.trim().length >= 10;

    const handleSubmit = async () => {
        if (!canSubmit || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await userSettingsApi.submitFeedback({
                type: type as string,
                content,
                contact,
                images: images.join(',') // API expects a string, so join array
            });
            setSubmitted(true);
            setType(null);
            setContent('');
            setContact('');
            setImages([]);
        } catch (error: any) {
            showAlert('提交失败', error.response?.data?.message || '无法提交反馈，请稍后重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#09090B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>意见反馈</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.successState}>
                    <View style={styles.successIconBox}>
                        <CheckCircle size={52} color="#22C55E" />
                    </View>
                    <Text style={styles.successTitle}>反馈已提交</Text>
                    <Text style={styles.successDesc}>
                        感谢您的宝贵意见！{'\n'}我们会在 1-3 个工作日内处理您的反馈
                    </Text>
                    <TouchableOpacity style={styles.successBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.successBtnText}>返回</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>意见反馈</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* 类型选择 */}
                <Text style={styles.sectionLabel}>反馈类型</Text>
                <View style={styles.typeGrid}>
                    {FEEDBACK_TYPES.map(t => (
                        <TouchableOpacity
                            key={t.id}
                            style={[
                                styles.typeCard,
                                type === t.id && { borderColor: t.color, backgroundColor: t.bg },
                            ]}
                            onPress={() => setType(t.id)}
                        >
                            <View style={[styles.typeIcon, { backgroundColor: type === t.id ? t.bg : '#F5F5F5' }]}>
                                {t.icon}
                            </View>
                            <Text style={[styles.typeLabel, type === t.id && { color: t.color, fontWeight: '600' }]}>
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 内容输入 */}
                <Text style={styles.sectionLabel}>详细描述</Text>
                <View style={styles.textareaCard}>
                    <TextInput
                        style={styles.textarea}
                        placeholder="请详细描述您遇到的问题或建议（至少10个字）"
                        placeholderTextColor="#A1A1AA"
                        multiline
                        maxLength={MAX_CHARS}
                        value={content}
                        onChangeText={setContent}
                        textAlignVertical="top"
                    />
                    <Text style={styles.charCount}>
                        {content.length}/{MAX_CHARS}
                    </Text>
                </View>

                {/* 图片上传 */}
                <Text style={styles.sectionLabel}>上传截图（选填）</Text>
                <View style={styles.imageGrid}>
                    {images.map((_, index) => (
                        <View key={index} style={styles.imagePlaceholder}>
                            <ImageIcon size={24} color="#A1A1AA" />
                            <Text style={styles.imagePlaceholderText}>图片 {index + 1}</Text>
                            <TouchableOpacity
                                style={styles.removeImageBtn}
                                onPress={() => handleRemoveImage(index)}
                            >
                                <X size={12} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {images.length < MAX_IMAGES && (
                        <TouchableOpacity style={styles.addImageBtn} onPress={handleAddImage}>
                            <Plus size={24} color="#A1A1AA" />
                            <Text style={styles.addImageText}>
                                {images.length}/{MAX_IMAGES}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 联系方式 */}
                <Text style={styles.sectionLabel}>联系方式（选填）</Text>
                <View style={styles.contactCard}>
                    <View style={styles.contactIconBox}>
                        <Phone size={16} color="#A1A1AA" />
                    </View>
                    <TextInput
                        style={styles.contactInput}
                        placeholder="手机号或邮箱，方便我们联系您"
                        placeholderTextColor="#A1A1AA"
                        value={contact}
                        onChangeText={setContact}
                        keyboardType="default"
                    />
                </View>

                {/* 提交 */}
                <TouchableOpacity
                    style={[styles.submitBtn, (!canSubmit || isSubmitting) && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                >
                    <Send size={18} color={canSubmit ? '#FFFFFF' : '#A1A1AA'} />
                    <Text style={[styles.submitBtnText, !canSubmit && styles.submitBtnTextDisabled]}>
                        {isSubmitting ? '提交中...' : '提交反馈'}
                    </Text>
                </TouchableOpacity>

                {!canSubmit && (
                    <Text style={styles.submitHint}>
                        请选择反馈类型并输入至少 10 个字的描述
                    </Text>
                )}

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
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    typeCard: {
        flexBasis: '47%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1.5,
        borderColor: '#E4E4E7',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    typeIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeLabel: { fontSize: 14, color: '#52525B', fontWeight: '500' },
    textareaCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    textarea: { minHeight: 140, fontSize: 15, color: '#09090B', lineHeight: 24 },
    charCount: { fontSize: 12, color: '#A1A1AA', textAlign: 'right', marginTop: 8 },
    imageGrid: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    imagePlaceholder: {
        width: 90,
        height: 90,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E4E4E7',
        gap: 4,
    },
    imagePlaceholderText: { fontSize: 11, color: '#A1A1AA' },
    removeImageBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#71717A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addImageBtn: {
        width: 90,
        height: 90,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#D4D4D8',
        borderStyle: 'dashed',
        gap: 4,
    },
    addImageText: { fontSize: 11, color: '#A1A1AA' },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    contactIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#F4F4F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactInput: { flex: 1, fontSize: 15, color: '#09090B' },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 14,
        paddingVertical: 16,
        marginTop: 28,
        shadowColor: PRIMARY_GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: { backgroundColor: '#E4E4E7', shadowOpacity: 0, elevation: 0 },
    submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    submitBtnTextDisabled: { color: '#A1A1AA' },
    submitHint: { textAlign: 'center', fontSize: 12, color: '#A1A1AA', marginTop: 10 },
    bottomSpacer: { height: 40 },
    // Success state
    successState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    successIconBox: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    successTitle: { fontSize: 22, fontWeight: '700', color: '#09090B', marginBottom: 12 },
    successDesc: {
        fontSize: 15,
        color: '#71717A',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 36,
    },
    successBtn: {
        backgroundColor: PRIMARY_GOLD,
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 14,
    },
    successBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});

export default FeedbackScreen;
