import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { PullToRefresh } from '../components';

// Demo 页面 - 展示下拉刷新组件效果
export const PullToRefreshDemo: React.FC = () => {
    const [items, setItems] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const [shouldFail, setShouldFail] = useState(false);

    // 模拟刷新请求
    const handleRefresh = async () => {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (shouldFail) {
            throw new Error('网络连接失败');
        }

        // 模拟新增数据
        setItems(prev => [prev.length + 1, ...prev]);
    };

    return (
        <View style={styles.container}>
            {/* 顶部控制栏 */}
            <View style={styles.header}>
                <Text style={styles.title}>下拉刷新 Demo</Text>
                <TouchableOpacity
                    style={[styles.toggleBtn, shouldFail && styles.toggleBtnActive]}
                    onPress={() => setShouldFail(prev => !prev)}
                >
                    <Text style={styles.toggleText}>
                        {shouldFail ? '模拟失败' : '模拟成功'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 下拉刷新区域 */}
            <PullToRefresh onRefresh={handleRefresh}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Text style={styles.hint}>👆 下拉触发刷新 (阈值: 60px)</Text>
                    {items.map((item, index) => (
                        <View key={`${item}-${index}`} style={styles.card}>
                            <View style={styles.cardIcon}>
                                <Text style={styles.cardIconText}>{item}</Text>
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={styles.cardTitle}>列表项 #{item}</Text>
                                <Text style={styles.cardDesc}>下拉刷新演示内容</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </PullToRefresh>

            {/* 底部导航栏 (保持固定) */}
            <View style={styles.tabBar}>
                <View style={styles.tabItem}>
                    <Text style={styles.tabIcon}>🏠</Text>
                    <Text style={styles.tabLabel}>首页</Text>
                </View>
                <View style={styles.tabItem}>
                    <Text style={styles.tabIcon}>💬</Text>
                    <Text style={styles.tabLabel}>通知</Text>
                </View>
                <View style={styles.tabItem}>
                    <Text style={styles.tabIcon}>👤</Text>
                    <Text style={styles.tabLabel}>我的</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    toggleBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#52c41a',
    },
    toggleBtnActive: {
        backgroundColor: '#ff4d4f',
    },
    toggleText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    hint: {
        textAlign: 'center',
        color: '#999',
        fontSize: 13,
        marginBottom: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#1890ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardIconText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 13,
        color: '#999',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: 20, // Safe area
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    tabIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    tabLabel: {
        fontSize: 11,
        color: '#666',
    },
});

export default PullToRefreshDemo;
