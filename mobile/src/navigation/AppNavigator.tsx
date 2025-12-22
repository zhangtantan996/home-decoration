import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Home, Sparkles, FileText, MessageSquare, User } from 'lucide-react-native';

// 导入页面
import HomeScreen from '../screens/HomeScreen';

import MySiteScreen from '../screens/MySiteScreen';
import MessageScreen from '../screens/MessageScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import InspirationScreen from '../screens/InspirationScreen';
import { LiveRoomScreen, VideoPlayerScreen, ArticleDetailScreen } from '../screens/InspirationDetails';
import { DesignerDetailScreen, WorkerDetailScreen, CompanyDetailScreen } from '../screens/ProviderDetails';
import { CaseGalleryScreen, CaseDetailScreen } from '../screens/CaseScreens';
import BookingScreen from '../screens/BookingScreen';
import ProjectTimelineScreen from '../screens/ProjectTimelineScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import PersonalInfoScreen from '../screens/PersonalInfoScreen';
import AccountSecurityScreen from '../screens/AccountSecurityScreen';

// 导入状态管理
import { useAuthStore } from '../store/authStore';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
                    tabBarIcon: ({ focused, color }) => (
                        <Home size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
                    ),
                }}
            />
            <Tab.Screen
                name="Inspiration"
                component={InspirationScreen}
                options={{
                    tabBarLabel: '灵感',
                    tabBarIcon: ({ focused, color }) => (
                        <Sparkles size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
                    ),
                }}
            />
            <Tab.Screen
                name="Progress"
                component={MySiteScreen}
                options={{
                    tabBarLabel: '进度',
                    tabBarIcon: ({ focused, color }) => (
                        <FileText size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
                    ),
                }}
            />
            <Tab.Screen
                name="Message"
                component={MessageScreen}
                options={{
                    tabBarLabel: '消息',
                    tabBarIcon: ({ focused, color }) => (
                        <MessageSquare size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: '我的',
                    tabBarIcon: ({ focused, color }) => (
                        <User size={22} color={color} strokeWidth={focused ? 2 : 1.5} />
                    ),
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

    useEffect(() => {
        loadStoredAuth();
    }, []);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {isAuthenticated ? (
                    <>
                        <Stack.Screen name="Main" component={MainTabs} />
                        <Stack.Screen name="LiveRoom" component={LiveRoomScreen} />
                        <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
                        <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
                        <Stack.Screen name="DesignerDetail" component={DesignerDetailScreen} />
                        <Stack.Screen name="WorkerDetail" component={WorkerDetailScreen} />
                        <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
                        <Stack.Screen name="CaseGallery" component={CaseGalleryScreen} />
                        <Stack.Screen name="CaseDetail" component={CaseDetailScreen} />
                        <Stack.Screen name="Booking" component={BookingScreen} />
                        <Stack.Screen name="ProjectTimeline" component={ProjectTimelineScreen} />
                        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
                        <Stack.Screen name="ChatSettings" component={ChatSettingsScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
                        <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
                        <Stack.Screen name="AccountSecurity" component={AccountSecurityScreen} />
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

