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
    User,
    CreditCard,
    Camera,
    CheckCircle,
    Clock,
    ShieldCheck,
    AlertCircle,
} from 'lucide-react-native';
import { useToast } from '../components/Toast';
import { userSettingsApi } from '../services/api';
import { formatServerDate } from '../utils/serverTime';

const PRIMARY_GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5ECD0';

interface RealNameAuthScreenProps {
    navigation: any;
}

type AuthStatus = 'not_verified' | 'pending' | 'verified';

const RealNameAuthScreen: React.FC<RealNameAuthScreenProps> = ({ navigation }) => {
    const { showAlert } = useToast();
    const [authStatus, setAuthStatus] = useState<AuthStatus>('not_verified');
    const [realName, setRealName] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [frontUploaded, setFrontUploaded] = useState(false);
    const [backUploaded, setBackUploaded] = useState(false);
    const [authData, setAuthData] = useState<any>(null);

    // Mock images since we don't have a real upload API yet
    const frontImage = "https://example.com/front.jpg";
    const backImage = "https://example.com/back.jpg";

    React.useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await userSettingsApi.getVerification();
            if (res.data) {
                setAuthData(res.data);
                if (res.data.status === 0) setAuthStatus('pending');
                else if (res.data.status === 1) setAuthStatus('verified');
                else setAuthStatus('not_verified'); // For explicitly rejected, you could have a rejected state
            }
        } catch (error) {
            console.error('Fetch verification err:', error);
        }
    };

    const handleUploadFront = () => {
        setFrontUploaded(true);
        showAlert('提示', '身份证正面照片已选择（模拟）');
    };

    const handleUploadBack = () => {
        setBackUploaded(true);
        showAlert('提示', '身份证背面照片已选择（模拟）');
    };

    const handleSubmit = async () => {
        if (!realName.trim()) {
            showAlert('提示', '请输入真实姓名');
            return;
        }
        if (!idNumber.trim() || idNumber.length !== 18) {
            showAlert('提示', '请输入正确的18位身份证号码');
            return;
        }
        if (!frontUploaded || !backUploaded) {
            showAlert('提示', '请上传身份证正反面照片');
            return;
        }

        try {
            await userSettingsApi.submitVerification({
                realName,
                idCard: idNumber,
                idFrontImage: frontImage,
                idBackImage: backImage
            });
            showAlert('提交成功', '实名认证资料已提交，预计1-3个工作日内完成审核', [
                {
                    text: '知道了', onPress: () => {
                        fetchStatus();
                    }
                },
            ]);
        } catch (error: any) {
            showAlert('提交失败', error.response?.data?.message || '无法提交认证，请稍后重试');
        }
    };

    const renderVerifiedStatus = () => (
        <View style={styles.statusCard}>
            <View style={styles.statusIconGreen}>
                <CheckCircle size={36} color="#22C55E" />
            </View>
            <Text style={styles.statusTitle}>已完成实名认证</Text>
            <Text style={styles.statusDesc}>您的身份信息已验证，可享受平台全部服务</Text>
            <View style={styles.verifiedInfo}>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>认证姓名</Text>
                    <Text style={styles.infoValue}>{authData?.realName?.replace(/.(?=.)/g, '*')}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>证件号码</Text>
                    <Text style={styles.infoValue}>{authData?.idCard?.replace(/(\d{4})\d{10}(\d{4})/, '$1 **** **** $2')}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>认证时间</Text>
                    <Text style={styles.infoValue}>{formatServerDate(authData?.updatedAt)}</Text>
                </View>
            </View>
        </View>
    );

    const renderPendingStatus = () => (
        <View style={styles.statusCard}>
            <View style={styles.statusIconYellow}>
                <Clock size={36} color={PRIMARY_GOLD} />
            </View>
            <Text style={styles.statusTitle}>审核中</Text>
            <Text style={styles.statusDesc}>您的实名认证资料正在审核中，预计1-3个工作日完成</Text>
        </View>
    );

    const renderForm = () => (
        <>
            {/* 说明卡片 */}
            <View style={styles.tipCard}>
                <ShieldCheck size={18} color={PRIMARY_GOLD} />
                <Text style={styles.tipText}>实名认证信息受法律保护，平台承诺严格保密，仅用于身份验证</Text>
            </View>

            {/* 表单 */}
            <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>基本信息</Text>
                <View style={styles.inputCard}>
                    <View style={styles.inputRow}>
                        <View style={styles.inputIconBox}>
                            <User size={16} color={PRIMARY_GOLD} />
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="请输入真实姓名"
                            placeholderTextColor="#A1A1AA"
                            value={realName}
                            onChangeText={setRealName}
                        />
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.inputRow}>
                        <View style={styles.inputIconBox}>
                            <CreditCard size={16} color={PRIMARY_GOLD} />
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="请输入18位身份证号码"
                            placeholderTextColor="#A1A1AA"
                            value={idNumber}
                            onChangeText={setIdNumber}
                            maxLength={18}
                            keyboardType="default"
                        />
                    </View>
                </View>
            </View>

            {/* 证件照上传 */}
            <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>证件照片</Text>
                <Text style={styles.sectionSubtitle}>请上传清晰、完整的身份证照片</Text>
                <View style={styles.uploadRow}>
                    <TouchableOpacity style={styles.uploadCard} onPress={handleUploadFront}>
                        {frontUploaded ? (
                            <View style={styles.uploadedState}>
                                <CheckCircle size={28} color="#22C55E" />
                                <Text style={styles.uploadedText}>正面已上传</Text>
                            </View>
                        ) : (
                            <View style={styles.uploadPlaceholder}>
                                <View style={styles.cameraIconBox}>
                                    <Camera size={24} color={PRIMARY_GOLD} />
                                </View>
                                <Text style={styles.uploadLabel}>身份证正面</Text>
                                <Text style={styles.uploadHint}>点击拍照或选取</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.uploadCard} onPress={handleUploadBack}>
                        {backUploaded ? (
                            <View style={styles.uploadedState}>
                                <CheckCircle size={28} color="#22C55E" />
                                <Text style={styles.uploadedText}>背面已上传</Text>
                            </View>
                        ) : (
                            <View style={styles.uploadPlaceholder}>
                                <View style={styles.cameraIconBox}>
                                    <Camera size={24} color={PRIMARY_GOLD} />
                                </View>
                                <Text style={styles.uploadLabel}>身份证背面</Text>
                                <Text style={styles.uploadHint}>点击拍照或选取</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* 注意事项 */}
            <View style={styles.noticeCard}>
                <View style={styles.noticeHeader}>
                    <AlertCircle size={16} color="#71717A" />
                    <Text style={styles.noticeTitle}>注意事项</Text>
                </View>
                <Text style={styles.noticeItem}>• 请确保身份证在有效期内</Text>
                <Text style={styles.noticeItem}>• 照片需清晰，四个角完整，无反光遮挡</Text>
                <Text style={styles.noticeItem}>• 支持 JPG、PNG 格式，单张不超过 10MB</Text>
                <Text style={styles.noticeItem}>• 信息提交后无法修改，请仔细核对</Text>
            </View>

            {/* 提交按钮 */}
            <TouchableOpacity
                style={[
                    styles.submitBtn,
                    (!realName || idNumber.length !== 18 || !frontUploaded || !backUploaded) && styles.submitBtnDisabled
                ]}
                onPress={handleSubmit}
                disabled={!realName || idNumber.length !== 18 || !frontUploaded || !backUploaded}
            >
                <Text style={styles.submitBtnText}>提交认证</Text>
            </TouchableOpacity>
            <View style={styles.bottomSpacer} />
        </>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>实名认证</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {authStatus === 'verified' && renderVerifiedStatus()}
                {authStatus === 'pending' && renderPendingStatus()}
                {authStatus === 'not_verified' && renderForm()}
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
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: GOLD_LIGHT,
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
        gap: 10,
    },
    tipText: { flex: 1, fontSize: 13, color: '#78550A', lineHeight: 20 },
    formSection: { marginTop: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#52525B', marginBottom: 8, marginLeft: 4 },
    sectionSubtitle: { fontSize: 12, color: '#A1A1AA', marginBottom: 10, marginLeft: 4 },
    inputCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    inputIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: GOLD_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    input: { flex: 1, fontSize: 16, color: '#09090B' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginHorizontal: 16 },
    uploadRow: { flexDirection: 'row', gap: 12 },
    uploadCard: {
        flex: 1,
        height: 130,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E4E4E7',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    uploadPlaceholder: { alignItems: 'center', gap: 6 },
    cameraIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: GOLD_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadLabel: { fontSize: 13, fontWeight: '600', color: '#09090B' },
    uploadHint: { fontSize: 11, color: '#A1A1AA' },
    uploadedState: { alignItems: 'center', gap: 8 },
    uploadedText: { fontSize: 13, color: '#22C55E', fontWeight: '500' },
    noticeCard: {
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    noticeTitle: { fontSize: 13, fontWeight: '600', color: '#52525B' },
    noticeItem: { fontSize: 12, color: '#71717A', lineHeight: 22 },
    submitBtn: {
        marginTop: 28,
        backgroundColor: PRIMARY_GOLD,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: PRIMARY_GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: { backgroundColor: '#D4D4D8', shadowOpacity: 0 },
    submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    bottomSpacer: { height: 40 },
    // Status screens
    statusCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 28,
        marginTop: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    statusIconGreen: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F0FDF4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    statusIconYellow: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: GOLD_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    statusTitle: { fontSize: 18, fontWeight: '700', color: '#09090B', marginBottom: 8 },
    statusDesc: { fontSize: 14, color: '#71717A', textAlign: 'center', lineHeight: 22 },
    verifiedInfo: { width: '100%', marginTop: 24, gap: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F8F8F8' },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E4E4E7',
    },
    infoLabel: { fontSize: 14, color: '#71717A' },
    infoValue: { fontSize: 14, fontWeight: '500', color: '#09090B' },
});

export default RealNameAuthScreen;
