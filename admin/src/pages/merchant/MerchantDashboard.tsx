import React, { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import {
    CalendarOutlined,
    FileTextOutlined,
    DollarOutlined,
    PictureOutlined,
    BankOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantDashboardApi, merchantIncomeApi, type MerchantDashboardStats, type MerchantIncomeSummary } from '../../services/merchantApi';
import styles from './MerchantDashboard.module.css';
import dayjs from 'dayjs';

const MerchantDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MerchantDashboardStats | null>(null);
    const [income, setIncome] = useState<MerchantIncomeSummary | null>(null);
    const navigate = useNavigate();
    const provider = JSON.parse(localStorage.getItem('merchant_provider') || '{}');

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, incomeRes] = await Promise.allSettled([
                merchantDashboardApi.stats(),
                merchantIncomeApi.summary(),
            ]);

            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value);
            }
            if (incomeRes.status === 'fulfilled') {
                setIncome(incomeRes.value);
            }

            if (statsRes.status === 'rejected' && incomeRes.status === 'rejected') {
                message.error('工作台数据加载失败');
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
        path,
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

    const isForeman = String(provider?.providerSubType || '').toLowerCase() === 'foreman';

    return (
        <div className={styles.container}>
            <div className={styles.heroSection}>
                <div className={styles.welcomeText}>
                    欢迎回来，{provider.name || '商家管理员'}
                </div>
                <div className={styles.dateText}>
                    {dayjs().format('YYYY年M月D日 · dddd')}
                </div>
            </div>

            <div className={styles.statsGrid}>
                <StatCard
                    icon={<CalendarOutlined />}
                    iconClass="iconBooking"
                    title="预约管理"
                    path="/bookings"
                    data={[
                        { label: '今日新增', value: stats?.todayBookings || 0, color: '#faad14' },
                        { label: '最近预约', value: '查看', color: '#1890ff' },
                    ]}
                />
                <StatCard
                    icon={<FileTextOutlined />}
                    iconClass="iconProposal"
                    title={isForeman ? '报价/施工方案' : '设计方案'}
                    path="/proposals"
                    data={[
                        { label: '待确认', value: stats?.pendingProposals || 0, color: '#faad14' },
                        { label: '本月营收', value: `¥${(stats?.monthRevenue || 0).toLocaleString()}`, color: '#52c41a' },
                    ]}
                />
                <StatCard
                    icon={<DollarOutlined />}
                    iconClass="iconOrder"
                    title="项目管理"
                    path="/orders"
                    data={[
                        { label: '进行中', value: stats?.activeProjects || 0, color: '#faad14' },
                        { label: '总营收', value: `¥${(stats?.totalRevenue ? (stats.totalRevenue / 10000).toFixed(1) + 'w' : 0)}`, color: '#52c41a' },
                    ]}
                />
                <StatCard
                    icon={<BankOutlined />}
                    iconClass="iconFinance"
                    title="财务概览"
                    path="/income"
                    data={[
                        { label: '可用余额', value: `¥${(income?.availableAmount || 0).toLocaleString()}`, color: '#f57c00' },
                        { label: '本月收入', value: `¥${(income?.pendingSettle || 0).toLocaleString()}`, color: '#263238' },
                    ]}
                />
            </div>

            <div className={styles.quickActionsUser}>
                <div className={styles.sectionTitle}>常用工具</div>
                <div className={styles.actionGrid}>
                    <QuickAction icon={<PictureOutlined />} label={isForeman ? '施工案例管理' : '作品集管理'} path="/cases" />
                    <QuickAction icon={<DollarOutlined />} label="收入中心" path="/income" />
                    <QuickAction icon={<BankOutlined />} label="银行账户" path="/bank-accounts" />
                    <QuickAction icon={<SettingOutlined />} label="账户设置" path="/settings" />
                </div>
            </div>
        </div>
    );
};

export default MerchantDashboard;
