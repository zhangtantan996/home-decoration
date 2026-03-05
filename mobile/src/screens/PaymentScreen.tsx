import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CreditCard, Shield, CheckCircle } from 'lucide-react-native';
import { bookingApi } from '../services/api';
import { useToast } from '../components/Toast';
import { RootStackParamList } from '../navigation/AppNavigator';
import CancelOrderModal from '../components/CancelOrderModal';

const { width } = Dimensions.get('window');

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'Payment'>;
type PaymentScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PaymentScreenProps {
    route: PaymentScreenRouteProp;
    navigation: PaymentScreenNavigationProp;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route, navigation }) => {
    const { showAlert } = useToast();

    const { bookingId, amount, providerName } = route.params;

    const [isLoading, setIsLoading] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [countdown, setCountdown] = useState(3);

    // Cancel Modal State
    const [cancelModalVisible, setCancelModalVisible] = useState(false);

    // Animation values
    const successScale = useRef(new Animated.Value(0)).current;
    const successOpacity = useRef(new Animated.Value(0)).current;
    const checkOpacity = useRef(new Animated.Value(0)).current;

    // Handle payment
    const handlePayment = async () => {
        if (isPaying || !bookingId) return;

        setIsPaying(true);
        try {
            // 模拟支付过程（延迟 1.5 秒）
            await new Promise(resolve => setTimeout(resolve, 1500));

            // 调用后端支付 API
            await bookingApi.payIntent(bookingId);

            // 支付成功
            setPaymentSuccess(true);
            playSuccessAnimation();

        } catch (error: any) {
            console.error('Payment Error:', error);
            showAlert('支付失败', '请重试');
        } finally {
            setIsPaying(false);
        }
    };

    // Show cancel modal
    const handleCancel = () => {
        setCancelModalVisible(true);
    };

    // Confirm cancel
    const handleConfirmCancel = async () => {
        setCancelModalVisible(false);
        try {
            await bookingApi.cancel(bookingId);
            // 简单提示后返回，或者跳转
            // 这里为了简洁，直接返回，实际项目中可能需要更细致的提示
            navigation.goBack();
        } catch (error: any) {
            const msg = error?.response?.data?.message || '取消失败，请重试';
            showAlert('错误', msg);
        }
    };

    // Success animation
    const playSuccessAnimation = () => {
        Animated.parallel([
            Animated.spring(successScale, {
                toValue: 1,
                friction: 5,
                tension: 80,
                useNativeDriver: true,
            }),
            Animated.timing(successOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            // Show checkmark after circle
            Animated.timing(checkOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        });
    };

    // Countdown and auto-navigate
    useEffect(() => {
        if (paymentSuccess && countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (paymentSuccess && countdown === 0) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
        }
    }, [paymentSuccess, countdown, navigation]);

    // Render success overlay
    if (paymentSuccess) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                <View style={styles.successContainer}>
                    <Animated.View
                        style={[
                            styles.successCircle,
                            {
                                transform: [{ scale: successScale }],
                                opacity: successOpacity,
                            },
                        ]}
                    >
                        <Animated.View style={{ opacity: checkOpacity }}>
                            <CheckCircle size={64} color="#FFFFFF" strokeWidth={2} />
                        </Animated.View>
                    </Animated.View>
                    <Text style={styles.successTitle}>支付成功</Text>
                    <Text style={styles.successSubtitle}>
                        您的预约已提交，商家将尽快与您联系
                    </Text>
                    <Text style={styles.countdown}>
                        {countdown}秒后自动返回首页
                    </Text>
                    <TouchableOpacity
                        style={styles.returnButton}
                        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
                    >
                        <Text style={styles.returnButtonText}>立即返回</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>支付意向金</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Amount Card */}
                <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>支付金额</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.currencySymbol}>¥</Text>
                        <Text style={styles.amountValue}>{amount || 99}</Text>
                    </View>
                    <Text style={styles.amountNote}>意向金可抵扣后续设计费</Text>
                </View>

                {/* Order Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>订单信息</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>服务商</Text>
                        <Text style={styles.infoValue}>{providerName || '设计师'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>订单类型</Text>
                        <Text style={styles.infoValue}>预约意向金</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>订单编号</Text>
                        <Text style={styles.infoValue}>BK{bookingId?.toString().padStart(8, '0')}</Text>
                    </View>
                </View>

                {/* Payment Method */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>支付方式</Text>
                    <TouchableOpacity style={styles.paymentMethod}>
                        <View style={styles.paymentMethodIcon}>
                            <CreditCard size={24} color="#09090B" />
                        </View>
                        <View style={styles.paymentMethodInfo}>
                            <Text style={styles.paymentMethodName}>模拟支付</Text>
                            <Text style={styles.paymentMethodDesc}>开发环境演示用</Text>
                        </View>
                        <View style={styles.radioSelected} />
                    </TouchableOpacity>
                </View>

                {/* Security Note */}
                <View style={styles.securityNote}>
                    <Shield size={16} color="#71717A" />
                    <Text style={styles.securityText}>
                        资金由平台托管，服务完成后结算
                    </Text>
                </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={handleCancel}
                    disabled={isPaying}
                >
                    <Text style={styles.cancelBtnText}>取消订单</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.payButton}
                    onPress={handlePayment}
                    disabled={isPaying}
                    activeOpacity={0.8}
                >
                    {isPaying ? (
                        <View style={styles.payingRow}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.payButtonText}>支付中...</Text>
                        </View>
                    ) : (
                        <Text style={styles.payButtonText}>立即支付 ¥{amount || 99}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Custom Cancel Modal */}
            <CancelOrderModal
                visible={cancelModalVisible}
                onClose={() => setCancelModalVisible(false)}
                onConfirm={handleConfirmCancel}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#09090B',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },

    // Amount Card
    amountCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    amountLabel: {
        fontSize: 14,
        color: '#71717A',
        marginBottom: 8,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 48,
        fontWeight: '700',
        color: '#09090B',
    },
    amountNote: {
        fontSize: 12,
        color: '#10B981',
        marginTop: 12,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },

    // Info Card
    infoCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 16,
        padding: 16,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    infoLabel: {
        fontSize: 14,
        color: '#71717A',
    },
    infoValue: {
        fontSize: 14,
        color: '#09090B',
        fontWeight: '500',
    },

    // Payment Method
    paymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    paymentMethodIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F4F4F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    paymentMethodInfo: {
        flex: 1,
        marginLeft: 12,
    },
    paymentMethodName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#09090B',
    },
    paymentMethodDesc: {
        fontSize: 12,
        color: '#71717A',
        marginTop: 2,
    },
    radioSelected: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 6,
        borderColor: '#09090B',
    },

    // Security Note
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        marginHorizontal: 16,
    },
    securityText: {
        fontSize: 12,
        color: '#71717A',
        marginLeft: 6,
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: '#F4F4F5',
    },
    footerLeft: {
        flex: 1,
    },
    footerLabel: {
        fontSize: 12,
        color: '#71717A',
    },
    footerAmountRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    footerCurrency: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
    },
    footerAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#09090B',
    },
    payButton: {
        backgroundColor: '#09090B',
        paddingHorizontal: 48,
        paddingVertical: 14,
        borderRadius: 12,
    },
    payButtonDisabled: {
        backgroundColor: '#A1A1AA',
    },
    payButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    payingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        marginRight: 12,
    },
    cancelBtnText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#71717A',
    },

    // Success
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 32,
    },
    successCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#09090B',
        marginBottom: 8,
    },
    successSubtitle: {
        fontSize: 14,
        color: '#71717A',
        textAlign: 'center',
        marginBottom: 24,
    },
    countdown: {
        fontSize: 14,
        color: '#A1A1AA',
        marginBottom: 24,
    },
    returnButton: {
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    returnButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#09090B',
    },
});

export default PaymentScreen;
