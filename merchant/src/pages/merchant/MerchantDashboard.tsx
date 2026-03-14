import React, { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import {
    NotificationOutlined,
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
            <div
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}
                role="status"
                aria-live="polite"
            >
                <Spin size="large" />
                <span className="sr-only">正在加载工作台数据</span>
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
    }) => {
        const handleKeyPress = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(path);
            }
        };

        return (
            <div
                className={styles.statCard}
                onClick={() => navigate(path)}
                onKeyPress={handleKeyPress}
                tabIndex={0}
                role="button"
                aria-label={`${title}：${data.map(d => `${d.label} ${d.value}`).join('，')}`}
                style={{ cursor: 'pointer' }}
            >
                <div className={styles.statHeader}>
                    <div className={`${styles.statIcon} ${styles[iconClass]}`} aria-hidden="true">
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
    };

    const QuickAction = ({ icon, label, path }: { icon: React.ReactNode; label: string; path: string }) => {
        const handleKeyPress = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(path);
            }
        };

        return (
            <div
                className={styles.actionButton}
                onClick={() => navigate(path)}
                onKeyPress={handleKeyPress}
                tabIndex={0}
                role="button"
                aria-label={label}
            >
                <div className={styles.actionIcon} aria-hidden="true">{icon}</div>
                <div className={styles.actionText}>{label}</div>
            </div>
        );
    };

    const providerSubType = String(provider?.providerSubType || '').toLowerCase();
    const applicantType = String(provider?.applicantType || '').toLowerCase();
    const isForeman = providerSubType === 'foreman';
    const isCompany = providerSubType === 'company' || applicantType === 'company';

    const dashboardTitle = isForeman
        ? '施工履约工作台'
        : isCompany
            ? '企业经营工作台'
            : '设计经营工作台';

    const dashboardSubtitle = isForeman
        ? '聚焦施工报价、项目履约与验收节奏，确保交付过程稳定透明。'
        : isCompany
            ? '聚焦线索分配、方案确认与订单推进，体现企业协同与交付能力。'
            : '聚焦方案转化、作品展示与预约响应，持续提升设计成交效率。';

    const statCards = isForeman
        ? [
            {
                icon: <NotificationOutlined />,
                iconClass: 'iconLead',
                title: '待开工项目',
                path: '/leads',
                data: [
                    { label: '新分配线索', value: stats?.pendingLeads || 0, color: '#d97706' },
                    { label: '立即跟进', value: '进入', color: '#2563eb' },
                ],
            },
            {
                icon: <CalendarOutlined />,
                iconClass: 'iconBooking',
                title: '进行中项目',
                path: '/orders',
                data: [
                    { label: '施工推进中', value: stats?.activeProjects || 0, color: '#faad14' },
                    { label: '查看项目', value: '进入', color: '#1890ff' },
                ],
            },
            {
                icon: <FileTextOutlined />,
                iconClass: 'iconProposal',
                title: '施工报价待确认',
                path: '/proposals',
                data: [
                    { label: '待确认', value: stats?.pendingProposals || 0, color: '#faad14' },
                    { label: '施工方案', value: '处理', color: '#2563eb' },
                ],
            },
            {
                icon: <DollarOutlined />,
                iconClass: 'iconOrder',
                title: '待验收项目',
                path: '/bookings',
                data: [
                    { label: '待处理预约', value: stats?.todayBookings || 0, color: '#faad14' },
                    { label: '验收节奏', value: '查看', color: '#1890ff' },
                ],
            },
            {
                icon: <BankOutlined />,
                iconClass: 'iconFinance',
                title: '本月回款 / 可提现',
                path: '/income',
                data: [
                    { label: '可用余额', value: `¥${(income?.availableAmount || 0).toLocaleString()}`, color: '#f57c00' },
                    { label: '本月回款', value: `¥${(stats?.monthRevenue || 0).toLocaleString()}`, color: '#263238' },
                ],
            },
        ]
        : isCompany
            ? [
                {
                    icon: <NotificationOutlined />,
                    iconClass: 'iconLead',
                    title: '待分配线索',
                    path: '/leads',
                    data: [
                        { label: '新线索', value: stats?.pendingLeads || 0, color: '#d97706' },
                        { label: '立即分配', value: '进入', color: '#2563eb' },
                    ],
                },
                {
                    icon: <CalendarOutlined />,
                    iconClass: 'iconBooking',
                    title: '待确认预约',
                    path: '/bookings',
                    data: [
                        { label: '待确认', value: stats?.todayBookings || 0, color: '#faad14' },
                        { label: '预约协同', value: '查看', color: '#1890ff' },
                    ],
                },
                {
                    icon: <FileTextOutlined />,
                    iconClass: 'iconProposal',
                    title: '待确认方案',
                    path: '/proposals',
                    data: [
                        { label: '方案待确认', value: stats?.pendingProposals || 0, color: '#faad14' },
                        { label: '标准交付', value: '进入', color: '#2563eb' },
                    ],
                },
                {
                    icon: <DollarOutlined />,
                    iconClass: 'iconOrder',
                    title: '进行中订单',
                    path: '/orders',
                    data: [
                        { label: '履约推进中', value: stats?.activeProjects || 0, color: '#faad14' },
                        { label: '订单协同', value: '查看', color: '#1890ff' },
                    ],
                },
                {
                    icon: <BankOutlined />,
                    iconClass: 'iconFinance',
                    title: '本月成交 / 可提现',
                    path: '/income',
                    data: [
                        { label: '可用余额', value: `¥${(income?.availableAmount || 0).toLocaleString()}`, color: '#f57c00' },
                        { label: '本月成交', value: `¥${(stats?.monthRevenue || 0).toLocaleString()}`, color: '#263238' },
                    ],
                },
            ]
            : [
                {
                    icon: <NotificationOutlined />,
                    iconClass: 'iconLead',
                    title: '待响应线索',
                    path: '/leads',
                    data: [
                        { label: '新分配需求', value: stats?.pendingLeads || 0, color: '#d97706' },
                        { label: '立即处理', value: '进入', color: '#2563eb' },
                    ],
                },
                {
                    icon: <CalendarOutlined />,
                    iconClass: 'iconBooking',
                    title: '待确认预约',
                    path: '/bookings',
                    data: [
                        { label: '今日新增', value: stats?.todayBookings || 0, color: '#faad14' },
                        { label: '最近预约', value: '查看', color: '#1890ff' },
                    ],
                },
                {
                    icon: <FileTextOutlined />,
                    iconClass: 'iconProposal',
                    title: '待确认方案',
                    path: '/proposals',
                    data: [
                        { label: '待确认', value: stats?.pendingProposals || 0, color: '#faad14' },
                        { label: '本月营收', value: `¥${(stats?.monthRevenue || 0).toLocaleString()}`, color: '#52c41a' },
                    ],
                },
                {
                    icon: <DollarOutlined />,
                    iconClass: 'iconOrder',
                    title: '进行中项目',
                    path: '/orders',
                    data: [
                        { label: '进行中', value: stats?.activeProjects || 0, color: '#faad14' },
                        { label: '总营收', value: `¥${(stats?.totalRevenue ? (stats.totalRevenue / 10000).toFixed(1) + 'w' : 0)}`, color: '#52c41a' },
                    ],
                },
                {
                    icon: <BankOutlined />,
                    iconClass: 'iconFinance',
                    title: '财务概览',
                    path: '/income',
                    data: [
                        { label: '可用余额', value: `¥${(income?.availableAmount || 0).toLocaleString()}`, color: '#f57c00' },
                        { label: '本月收入', value: `¥${(income?.pendingSettle || 0).toLocaleString()}`, color: '#263238' },
                    ],
                },
            ];

    const quickActions = isForeman
        ? [
            { icon: <NotificationOutlined />, label: '施工线索', path: '/leads' },
            { icon: <PictureOutlined />, label: '施工案例管理', path: '/cases' },
            { icon: <DollarOutlined />, label: '工长价格库', path: '/price-book' },
            { icon: <BankOutlined />, label: '收入中心', path: '/income' },
            { icon: <SettingOutlined />, label: '施工设置', path: '/settings' },
        ]
        : isCompany
            ? [
                { icon: <NotificationOutlined />, label: '线索分配', path: '/leads' },
                { icon: <FileTextOutlined />, label: '方案协同', path: '/proposals' },
                { icon: <PictureOutlined />, label: '公司案例', path: '/cases' },
                { icon: <BankOutlined />, label: '收入中心', path: '/income' },
                { icon: <SettingOutlined />, label: '企业设置', path: '/settings' },
            ]
            : [
                { icon: <NotificationOutlined />, label: '线索管理', path: '/leads' },
                { icon: <PictureOutlined />, label: '作品集管理', path: '/cases' },
                { icon: <DollarOutlined />, label: '收入中心', path: '/income' },
                { icon: <BankOutlined />, label: '银行账户', path: '/bank-accounts' },
                { icon: <SettingOutlined />, label: '账户设置', path: '/settings' },
            ];

    return (
        <div className={styles.container}>
            <div className={styles.heroSection}>
                <div className={styles.welcomeText}>
                    {dashboardTitle} · {provider.name || '商家管理员'}
                </div>
                <div className={styles.dateText}>
                    {dayjs().format('YYYY年M月D日 · dddd')} · {dashboardSubtitle}
                </div>
            </div>

            <div className={styles.statsGrid}>
                {statCards.map((card) => (
                    <StatCard key={card.path} {...card} />
                ))}
            </div>

            <div className={styles.quickActionsUser}>
                <div className={styles.sectionTitle}>常用工具</div>
                <div className={styles.actionGrid}>
                    {quickActions.map((action) => (
                        <QuickAction key={action.path} {...action} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MerchantDashboard;
