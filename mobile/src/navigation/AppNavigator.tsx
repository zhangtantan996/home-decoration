import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Home, Sparkles, FileText, Bell, User } from 'lucide-react-native';

// 导入页面
import HomeScreen from '../screens/HomeScreen';

import MySiteScreen from '../screens/MySiteScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import InspirationScreen from '../screens/InspirationScreen';
import { InspirationDetailScreen } from '../screens/InspirationDetails';
import { MaterialShopDetailScreen } from '../screens/MaterialShopDetailScreen';
import { DesignerDetailScreen, WorkerDetailScreen, CompanyDetailScreen } from '../screens/ProviderDetails';
import { CaseGalleryScreen, CaseDetailScreen } from '../screens/CaseScreens';
import BookingScreen from '../screens/BookingScreen';
import ProjectTimelineScreen from '../screens/ProjectTimelineScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import AccountSecurityScreen from '../screens/AccountSecurityScreen';
import PullToRefreshDemo from '../screens/PullToRefreshDemo';
import { ScanQRScreen } from '../screens/ScanQRScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';
import ProposalDetailScreen from '../screens/ProposalDetailScreen';
import BillScreen from '../screens/BillScreen';
import PaymentScreen from '../screens/PaymentScreen';
import OrderListScreen from '../screens/OrderListScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import AfterSalesScreen from '../screens/AfterSalesScreen';
import PendingScreen from '../screens/PendingScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import DesignFeePaymentScreen from '../screens/DesignFeePaymentScreen';
import ProposalPaidDetailScreen from '../screens/ProposalPaidDetailScreen';
import CreateProjectScreen from '../screens/CreateProjectScreen';
import ProjectListScreen from '../screens/ProjectListScreen';
import NotificationScreen from '../screens/NotificationScreen';
import DesignFilesScreen from '../screens/DesignFilesScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PrivacySettingsScreen from '../screens/PrivacySettingsScreen';
import PaymentSettingsScreen from '../screens/PaymentSettingsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import GeneralSettingsScreen from '../screens/GeneralSettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import RealNameVerificationScreen from '../screens/RealNameVerificationScreen';
import DeviceManagementScreen from '../screens/DeviceManagementScreen';
import AccountCancellationScreen from '../screens/AccountCancellationScreen';
import LegalDocumentScreen from '../screens/LegalDocumentScreen';
import ChangePhoneScreen from '../screens/ChangePhoneScreen';

// 导入状态管理
import { useAuthStore } from '../store/authStore';
import { useProviderStore } from '../store/providerStore';
import { useSessionExpiry } from '../hooks/useSessionExpiry';
import { notificationRealtimeService } from '../services/notificationRealtimeService';

// 定义导航参数列表
export type RootStackParamList = {
    Main: undefined;
    Login: undefined;
    Booking: {
        providerId: string;
        providerType: 'designer' | 'worker' | 'company';
        providerName: string;
        providerAvatar: string;
        providerRating?: number;
    };
    Payment: {
        bookingId: number;
        amount: number;
        providerName?: string;
    };
    OrderList: {
        tab?: 'all' | 'pending_payment' | 'pending' | 'in_progress' | 'to_review' | 'cancelled';
    };
    OrderDetail: {
        orderId: number;
    };
    AfterSales: {
        tab?: 'all' | 'pending' | 'processing' | 'completed';
    };
    Favorites: undefined;
    LegalDocument: {
        documentType: 'collection' | 'sharing' | 'privacy' | 'terms';
    };
    [key: string]: any;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const homeTabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
    <Home size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
);

const inspirationTabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
    <Sparkles size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
);

const progressTabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
    <FileText size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
);

const notificationTabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
    <Bell size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
);

const profileTabIcon = ({ focused, color }: { focused: boolean; color: string }) => (
    <User size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
);

// 底部Tab导航
const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    height: Platform.OS === 'ios' ? 88 : 70,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
                    paddingTop: 6,
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#F4F4F5',
                    elevation: 0,
                    shadowOpacity: 0,
                },
                tabBarActiveTintColor: '#09090B',
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    marginTop: 4,
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarLabel: '首页',
                    tabBarIcon: homeTabIcon,
                }}
            />
            <Tab.Screen
                name="Inspiration"
                component={InspirationScreen}
                options={{
                    tabBarLabel: '灵感',
                    tabBarIcon: inspirationTabIcon,
                }}
            />
            <Tab.Screen
                name="Progress"
                component={MySiteScreen}
                options={{
                    tabBarLabel: '进度',
                    tabBarIcon: progressTabIcon,
                }}
            />
            <Tab.Screen
                name="Message"
                component={NotificationScreen}
                options={{
                    tabBarLabel: '通知',
                    tabBarIcon: notificationTabIcon,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: '我的',
                    tabBarIcon: profileTabIcon,
                }}
            />
        </Tab.Navigator>
    );
};

// 加载页面
const LoadingScreen = () => (
    <View style={styles.loading}>
        <ActivityIndicator size="large" color="#09090B" />
        <Text style={styles.loadingText}>加载中...</Text>
    </View>
);

// 根导航
const AppNavigator = () => {
    const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();
    const preloadAll = useProviderStore(state => state.preloadAll);

    // 监听会话过期事件，自动跳转登录页
    useSessionExpiry();

    useEffect(() => {
        loadStoredAuth();
        // 应用启动时预加载首页数据，用户进入首页时数据已就绪
        preloadAll();
    }, [loadStoredAuth, preloadAll]);

    useEffect(() => {
        if (isAuthenticated) {
            // 登录成功后立即尝试获取数据
            preloadAll();
        }
    }, [isAuthenticated, preloadAll]);

    useEffect(() => {
        if (!isAuthenticated) {
            notificationRealtimeService.stop();
            return;
        }

        notificationRealtimeService.start();
        return () => {
            notificationRealtimeService.stop();
        };
    }, [isAuthenticated]);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isAuthenticated ? (
                    <>
                        <Stack.Screen name="Main" component={MainTabs} />
                        <Stack.Screen
                            name="InspirationDetail"
                            component={InspirationDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="MaterialShopDetail"
                            component={MaterialShopDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="DesignerDetail"
                            component={DesignerDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="WorkerDetail"
                            component={WorkerDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="CompanyDetail"
                            component={CompanyDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="CaseGallery"
                            component={CaseGalleryScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="CaseDetail"
                            component={CaseDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen name="Booking" component={BookingScreen} />
                        <Stack.Screen name="ProjectTimeline" component={ProjectTimelineScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="ChangePhone" component={ChangePhoneScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                        <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
                        <Stack.Screen name="AccountSecurity" component={AccountSecurityScreen} />
                        <Stack.Screen name="PullToRefreshDemo" component={PullToRefreshDemo} />
                        <Stack.Screen
                            name="ScanQR"
                            component={ScanQRScreen}
                            options={{
                                presentation: 'fullScreenModal',
                                animation: 'fade' // 模拟相机启动的淡入感
                            }}
                        />
                        <Stack.Screen name="Reviews" component={ReviewsScreen} />
                        {/* 业务流程扩展 */}
                        <Stack.Screen
                            name="ProposalDetail"
                            component={ProposalDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="Pending"
                            component={PendingScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="Payment"
                            component={PaymentScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="OrderList"
                            component={OrderListScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="OrderDetail"
                            component={OrderDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="AfterSales"
                            component={AfterSalesScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="Bill"
                            component={BillScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="DesignFiles"
                            component={DesignFilesScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="ProjectDetail"
                            component={ProjectDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="DesignFeePayment"
                            component={DesignFeePaymentScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="ProposalPaidDetail"
                            component={ProposalPaidDetailScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="CreateProject"
                            component={CreateProjectScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="ProjectList"
                            component={ProjectListScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="Notification"
                            component={NotificationScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="Favorites"
                            component={FavoritesScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        {/* 设置子页面 */}
                        <Stack.Screen
                            name="RealNameVerification"
                            component={RealNameVerificationScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="DeviceManagement"
                            component={DeviceManagementScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="AccountCancellation"
                            component={AccountCancellationScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="PrivacySettings"
                            component={PrivacySettingsScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="PaymentSettings"
                            component={PaymentSettingsScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="NotificationSettings"
                            component={NotificationSettingsScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="GeneralSettings"
                            component={GeneralSettingsScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="About"
                            component={AboutScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="Feedback"
                            component={FeedbackScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="LegalDocument"
                            component={LegalDocumentScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                    </>
                ) : (
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        color: '#71717A',
        fontSize: 14,
    },
});

export default AppNavigator;
