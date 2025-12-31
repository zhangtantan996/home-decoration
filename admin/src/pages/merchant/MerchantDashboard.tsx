import React, { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import {
    CalendarOutlined,
    FileTextOutlined,
    DollarOutlined,
    PictureOutlined,
    BankOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantDashboardApi, merchantIncomeApi } from '../../services/merchantApi';
import styles from './MerchantDashboard.module.css';
import dayjs from 'dayjs';

interface DashboardStats {
    todayBookings: number;
    pendingProposals: number;
    activeProjects: number;
    totalRevenue: number;
    monthRevenue: number;
    rating: number;
    reviewCount: number;
}

interface IncomeSummary {
    availableBalance: number;
    monthIncome: number;
}

const MerchantDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [income, setIncome] = useState<IncomeSummary | null>(null);
    const navigate = useNavigate();
    const provider = JSON.parse(localStorage.getItem('merchant_provider') || '{}');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Simultaneously fetch dashboard stats and income summary
            // Note: If one fails, we catch the error, but we try to display what we can
            const [statsRes, incomeRes] = await Promise.allSettled([
                merchantDashboardApi.stats(),
                merchantIncomeApi.summary()
            ]);

            if (statsRes.status === 'fulfilled' && (statsRes.value as any).code === 0) {
                setStats((statsRes.value as any).data);
            }
            if (incomeRes.status === 'fulfilled' && (incomeRes.value as any).code === 0) {
                setIncome((incomeRes.value as any).data);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            message.error('部分数据加载失败');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
                <Spin size="large" />
            </div>
        );
    }

    const StatCard = ({
        icon,
        iconClass,
        title,
        data,
        path
    }: {
        icon: React.ReactNode;
        iconClass: string;
        title: string;
        data: Array<{ label: string; value: number | string; color?: string }>;
        path: string;
    }) => (
        <div className={styles.statCard} onClick={() => navigate(path)} style={{ cursor: 'pointer' }}>
            <div className={styles.statHeader}>
                <div className={`${styles.statIcon} ${styles[iconClass]}`}>
                    {icon}
                </div>
                <div className={styles.statTitle}>{title}</div>
            </div>
            <div className={styles.statContent}>
                {data.map((item, index) => (
                    <div key={index} className={styles.statItem}>
                        <div className={styles.statLabel}>{item.label}</div>
                        <div className={styles.statValue} style={{ color: item.color }}>{item.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );

    const QuickAction = ({ icon, label, path }: { icon: React.ReactNode; label: string; path: string }) => (
        <div className={styles.actionButton} onClick={() => navigate(path)}>
            <div className={styles.actionIcon}>{icon}</div>
            <div className={styles.actionText}>{label}</div>
        </div>
    );

    return (
        <div className={styles.container}>
            {/* Hero Section */}
            <div className={styles.heroSection}>
                <div className={styles.welcomeText}>
                    欢迎回来，{provider.name || '商家管理员'}
                </div>
                <div className={styles.dateText}>
                    {dayjs().format('YYYY年M月D日 · dddd')}
                </div>
            </div>

            {/* Statistics Cards */}
            <div className={styles.statsGrid}>
                <StatCard
                    icon={<CalendarOutlined />}
                    iconClass="iconBooking"
                    title="预约管理"
                    path="/bookings"
                    data={[
                        { label: '今日新增', value: stats?.todayBookings || 0, color: '#faad14' },
                        { label: '最近预约', value: '查看', color: '#1890ff' }
                    ]}
                />
                <StatCard
                    icon={<FileTextOutlined />}
                    iconClass="iconProposal"
                    title="设计方案"
                    path="/proposals"
                    data={[
                        { label: '待确认', value: stats?.pendingProposals || 0, color: '#faad14' },
                        { label: '本月营收', value: `¥${(stats?.monthRevenue || 0).toLocaleString()}`, color: '#52c41a' }
                    ]}
                />
                <StatCard
                    icon={<DollarOutlined />}
                    iconClass="iconOrder"
                    title="项目管理"
                    path="/orders"
                    data={[
                        { label: '进行中', value: stats?.activeProjects || 0, color: '#faad14' },
                        { label: '总营收', value: `¥${(stats?.totalRevenue ? (stats.totalRevenue / 10000).toFixed(1) + 'w' : 0)}`, color: '#52c41a' }
                    ]}
                />
                <StatCard
                    icon={<BankOutlined />}
                    iconClass="iconFinance"
                    title="财务概览"
                    path="/income"
                    data={[
                        { label: '可用余额', value: `¥${(income?.availableBalance || 0).toLocaleString()}`, color: '#f57c00' },
                        { label: '本月收入', value: `¥${(income?.monthIncome || 0).toLocaleString()}`, color: '#263238' }
                    ]}
                />
            </div>

            {/* Quick Actions */}
            <div className={styles.quickActionsUser}>
                <div className={styles.sectionTitle}>常用工具</div>
                <div className={styles.actionGrid}>
                    <QuickAction icon={<PictureOutlined />} label="作品集管理" path="/cases" />
                    <QuickAction icon={<DollarOutlined />} label="收入中心" path="/income" />
                    <QuickAction icon={<BankOutlined />} label="银行账户" path="/bank-accounts" />
                    <QuickAction icon={<SettingOutlined />} label="账户设置" path="/settings" />
                </div>
            </div>
        </div>
    );
};

export default MerchantDashboard;
