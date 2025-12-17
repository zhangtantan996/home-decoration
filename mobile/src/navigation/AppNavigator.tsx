import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';

// 导入页面
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import MySiteScreen from '../screens/MySiteScreen';
import MessageScreen from '../screens/MessageScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';

// 导入状态管理
import { useAuthStore } from '../store/authStore';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab 图标
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{name}</Text>
);

// 底部Tab导航
const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 8 },
                tabBarActiveTintColor: '#1890FF',
                tabBarInactiveTintColor: '#999',
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarLabel: '首页',
                    tabBarIcon: ({ focused }) => <TabIcon name="🏠" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Search"
                component={SearchScreen}
                options={{
                    tabBarLabel: '发现',
                    tabBarIcon: ({ focused }) => <TabIcon name="🔍" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="MySite"
                component={MySiteScreen}
                options={{
                    tabBarLabel: '工地',
                    tabBarIcon: ({ focused }) => <TabIcon name="🏗️" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Message"
                component={MessageScreen}
                options={{
                    tabBarLabel: '消息',
                    tabBarIcon: ({ focused }) => <TabIcon name="💬" focused={focused} />,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: '我的',
                    tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} />,
                }}
            />
        </Tab.Navigator>
    );
};

// 加载页面
const LoadingScreen = () => (
    <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1890FF" />
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
                    <Stack.Screen name="Main" component={MainTabs} />
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
        color: '#999',
    },
});

export default AppNavigator;
