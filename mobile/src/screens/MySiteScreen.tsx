import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { projectApi, escrowApi } from '../services/api';

interface Milestone {
    id: number;
    name: string;
    status: string;
    progress: number;
}

interface Project {
    id: number;
    name: string;
    address: string;
    current_phase: string;
    status: string;
    budget: number;
    start_date?: string;
    milestones?: Milestone[];
}

const MySiteScreen: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [escrowBalances, setEscrowBalances] = useState<{ [key: number]: number }>({});

    const fetchData = async () => {
        try {
            const data: any = await projectApi.list();
            const projectList = Array.isArray(data) ? data : [];
            setProjects(projectList);

            // 获取每个项目的托管余额
            const balances: { [key: number]: number } = {};
            for (const project of projectList) {
                try {
                    const escrow: any = await escrowApi.getAccount(project.id.toString());
                    balances[project.id] = escrow?.balance || 0;
                } catch (e) {
                    balances[project.id] = 0;
                }
            }
            setEscrowBalances(balances);
        } catch (error) {
            console.log('Failed to fetch projects:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'in_progress': return '#52C41A';
            case 'completed': return '#1890FF';
            case 'pending': return '#FAAD14';
            default: return '#999';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'in_progress': return '🟢 进行中';
            case 'completed': return '✅ 已完成';
            case 'pending': return '⏸️ 待开始';
            default: return status;
        }
    };

    const calculateProgress = (project: Project) => {
        // 简单根据阶段计算进度
        const phases = ['设计阶段', '水电阶段', '泥木阶段', '油漆阶段', '安装阶段', '验收阶段'];
        const currentIndex = phases.findIndex(p => project.current_phase?.includes(p.replace('阶段', '')));
        if (currentIndex === -1) return 10;
        return Math.round(((currentIndex + 1) / phases.length) * 100);
    };

    const formatMoney = (amount: number) => {
        if (amount >= 10000) {
            return `¥${(amount / 10000).toFixed(1)}万`;
        }
        return `¥${amount}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>我的工地</Text>
                <TouchableOpacity style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ 新建项目</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#1890FF" />
                        <Text style={styles.loadingText}>加载中...</Text>
                    </View>
                ) : projects.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>🏠</Text>
                        <Text style={styles.emptyTitle}>暂无装修项目</Text>
                        <Text style={styles.emptySubtitle}>点击右上角创建您的第一个装修项目</Text>
                        <TouchableOpacity style={styles.createBtn}>
                            <Text style={styles.createBtnText}>立即创建</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    projects.map((project) => {
                        const progress = calculateProgress(project);
                        const balance = escrowBalances[project.id] || 0;

                        return (
                            <TouchableOpacity key={project.id} style={styles.projectCard}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={styles.projectName}>{project.name}</Text>
                                        <Text style={styles.projectAddress}>{project.address}</Text>
                                    </View>
                                    <Text style={[
                                        styles.status,
                                        { color: getStatusColor(project.status) }
                                    ]}>
                                        {getStatusText(project.status)}
                                    </Text>
                                </View>

                                <View style={styles.progressSection}>
                                    <View style={styles.progressHeader}>
                                        <Text style={styles.phase}>
                                            {project.current_phase || '准备中'}
                                        </Text>
                                        <Text style={styles.progressText}>{progress}%</Text>
                                    </View>
                                    <View style={styles.progressBar}>
                                        <View style={[
                                            styles.progressFill,
                                            { width: `${progress}%` }
                                        ]} />
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.footerItem}>
                                        <Text style={styles.footerIcon}>💰</Text>
                                        <Text style={styles.footerLabel}>托管余额</Text>
                                        <Text style={styles.footerValue}>
                                            {formatMoney(balance)}
                                        </Text>
                                    </View>
                                    <View style={styles.footerItem}>
                                        <Text style={styles.footerIcon}>📋</Text>
                                        <Text style={styles.footerLabel}>总预算</Text>
                                        <Text style={styles.footerValue}>
                                            {formatMoney(project.budget || 0)}
                                        </Text>
                                    </View>
                                    <View style={styles.footerItem}>
                                        <Text style={styles.footerIcon}>📷</Text>
                                        <Text style={styles.footerLabel}>施工日志</Text>
                                        <Text style={[styles.footerValue, styles.linkText]}>
                                            查看 &gt;
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#fff',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    addBtn: {
        backgroundColor: '#1890FF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    addBtnText: {
        color: '#fff',
        fontSize: 13,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#999',
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#999',
        marginBottom: 24,
    },
    createBtn: {
        backgroundColor: '#1890FF',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
    },
    createBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    projectCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    projectName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    projectAddress: {
        fontSize: 13,
        color: '#999',
    },
    status: {
        fontSize: 13,
    },
    progressSection: {
        marginBottom: 16,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    phase: {
        fontSize: 14,
        color: '#666',
    },
    progressText: {
        fontSize: 14,
        color: '#1890FF',
        fontWeight: '600',
    },
    progressBar: {
        height: 8,
        backgroundColor: '#E8E8E8',
        borderRadius: 4,
    },
    progressFill: {
        height: 8,
        backgroundColor: '#1890FF',
        borderRadius: 4,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    footerItem: {
        alignItems: 'center',
    },
    footerIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    footerLabel: {
        fontSize: 12,
        color: '#999',
        marginBottom: 2,
    },
    footerValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    linkText: {
        color: '#1890FF',
    },
});

export default MySiteScreen;
