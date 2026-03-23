import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import { ArrowLeft, MapPin, Calendar, ChevronRight } from 'lucide-react-native';
import { projectApi } from '../services/api';
import { formatServerDate } from '../utils/serverTime';

interface Project {
    id: number;
    name: string;
    address: string;
    status: number;
    currentPhase: string;
    startDate: string;
    expectedEnd: string;
    entryStartDate: string;
    entryEndDate: string;
    providerName: string;
}

interface ProjectListScreenProps {
    navigation: any;
}

const ProjectListScreen: React.FC<ProjectListScreenProps> = ({ navigation }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            setLoading(true);
            const res = await projectApi.list();
            setProjects(res.data.list || []);
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusText = (status: number) => {
        switch (status) {
            case -1: return '待完善';
            case 0: return '待准备';
            case 1: return '施工中';
            case 2: return '已完工';
            default: return '未知状态';
        }
    };

    const getStatusColor = (status: number) => {
        switch (status) {
            case -1: return '#F97316'; // Orange
            case 0: return '#F59E0B';
            case 1: return '#10B981';
            case 2: return '#3B82F6';
            default: return '#71717A';
        }
    };

    const renderProjectItem = ({ item }: { item: Project }) => {
        const isPending = item.status === -1;

        return (
            <TouchableOpacity
                style={[styles.projectCard, isPending && styles.pendingCard]}
                onPress={() => {
                    if (isPending) {
                        // 如果是待完善项目（ID即为方案ID），跳转到方案详情或直接创建
                        navigation.navigate('ProposalDetail', { proposalId: item.id });
                    } else {
                        navigation.navigate('ProjectDetail', { projectId: item.id });
                    }
                }}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.titleRow}>
                        <Text style={styles.projectName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View style={[styles.statusTag, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                {getStatusText(item.status)}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.phaseText}>当前阶段：{item.currentPhase}</Text>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                        <MapPin size={16} color="#71717A" />
                        <Text style={styles.infoText} numberOfLines={1}>{item.address}</Text>
                    </View>
                    {(item.startDate || item.entryStartDate) && (
                        <View style={styles.infoRow}>
                            <Calendar size={16} color="#71717A" />
                            <Text style={styles.infoText}>
                                {formatServerDate(item.startDate || item.entryStartDate)} 开工
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.providerName}>
                        {item.providerName || '待分配服务商'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isPending && <Text style={{ fontSize: 13, color: '#F97316', marginRight: 4 }}>去完善</Text>}
                        <ChevronRight size={16} color={isPending ? '#F97316' : '#A1A1AA'} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#09090B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>我的项目</Text>
                <View style={styles.placeholder} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#09090B" />
                </View>
            ) : projects.length > 0 ? (
                <FlatList
                    data={projects}
                    renderItem={renderProjectItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>暂无装修项目</Text>
                    <Text style={styles.emptySubText}>确认设计方案后将自动创建项目</Text>
                </View>
            )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
    },
    projectCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    projectName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#09090B',
        flex: 1,
        marginRight: 8,
    },
    statusTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    phaseText: {
        fontSize: 13,
        color: '#52525B',
    },
    cardBody: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F4F4F5',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    infoText: {
        fontSize: 13,
        color: '#71717A',
        marginLeft: 6,
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    providerName: {
        fontSize: 13,
        color: '#09090B',
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#09090B',
        marginBottom: 8,
    },
    emptySubText: {
        fontSize: 14,
        color: '#A1A1AA',
    },
    pendingCard: {
        borderWidth: 1,
        borderColor: '#F97316',
        backgroundColor: '#FFF7ED', // Orange-50
    },
});

export default ProjectListScreen;
