import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Space, Spin, Tag, message } from 'antd';
import {
    AppstoreOutlined,
    BankOutlined,
    DollarOutlined,
    FileTextOutlined,
    NotificationOutlined,
    PictureOutlined,
    PlusOutlined,
    ProjectOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import type { MerchantStatItem } from '../../components/MerchantStatGrid';
import styles from '../../components/MerchantPage.module.css';
import {
    materialShopCenterApi,
    merchantDashboardApi,
    merchantIncomeApi,
    type MaterialShopProduct,
    type MerchantDashboardStats,
    type MerchantIncomeSummary,
} from '../../services/merchantApi';

type MerchantProviderSnapshot = {
    name?: string;
    role?: string;
    merchantKind?: string;
    providerSubType?: string;
    applicantType?: string;
};

const MerchantDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MerchantDashboardStats | null>(null);
    const [income, setIncome] = useState<MerchantIncomeSummary | null>(null);
    const [products, setProducts] = useState<MaterialShopProduct[]>([]);
    const [profileCompletePercent, setProfileCompletePercent] = useState(0);
    const navigate = useNavigate();
    const provider = useMemo<MerchantProviderSnapshot>(() => {
        try {
            return JSON.parse(localStorage.getItem('merchant_provider') || '{}') as MerchantProviderSnapshot;
        } catch {
            return {};
        }
    }, []);

    const isMaterialShop = provider?.merchantKind === 'material_shop' || provider?.role === 'material_shop';

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            if (isMaterialShop) {
                const [productRes, incomeRes, orderStatsRes, profileRes] = await Promise.allSettled([
                    materialShopCenterApi.listProducts(),
                    merchantIncomeApi.summary(),
                    merchantDashboardApi.stats(),
                    materialShopCenterApi.getMe(),
                ]);

                if (productRes.status === 'fulfilled') {
                    setProducts(productRes.value.list || []);
                }
                if (incomeRes.status === 'fulfilled') {
                    setIncome(incomeRes.value);
                }
                if (orderStatsRes.status === 'fulfilled') {
                    setStats(orderStatsRes.value);
                }
                if (profileRes.status === 'fulfilled') {
                    const profile = profileRes.value;
                    const fields = [
                        profile.shopName,
                        profile.companyName,
                        profile.shopDescription,
                        profile.businessLicenseNo,
                        profile.businessLicense,
                        profile.legalPersonName,
                        profile.contactPhone,
                        profile.contactName,
                        profile.address,
                        profile.businessHoursRanges?.length ? 'ranges' : profile.businessHours,
                    ];
                    const completed = fields.filter((item) => String(item || '').trim()).length;
                    setProfileCompletePercent(Math.round((completed / fields.length) * 100));
                }

                if (
                    productRes.status === 'rejected'
                    && incomeRes.status === 'rejected'
                    && orderStatsRes.status === 'rejected'
                ) {
                    message.error('工作台数据加载失败');
                }
                return;
            }

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

    if (isMaterialShop) {
        const withImagesCount = products.filter((item) => (item.images || []).length > 0).length;
        const missingImagesCount = products.filter((item) => !(item.images || []).length).length;
        const missingDescriptionCount = products.filter((item) => !String(item.description || '').trim()).length;
        const readyProductsCount = products.filter((item) => (item.images || []).length > 0 && String(item.description || '').trim()).length;
        const pendingImproveCount = missingImagesCount + missingDescriptionCount;
        const remainingTargetCount = Math.max(0, 20 - products.length);

        return (
            <MerchantPageShell>
                <MerchantPageHeader
                    title="主材商工作台"
                    description="本期只聚焦工作台、商品管理与店铺设置，先把商品资料和店铺资料统一收口。"
                    meta={(
                        <>
                            <Tag color="blue">主材商</Tag>
                            <span className={styles.mutedNote}>{dayjs().format('YYYY年M月D日 · dddd')}</span>
                        </>
                    )}
                    extra={(
                        <Space>
                            <Button icon={<PlusOutlined />} type="primary" onClick={() => navigate('/material-shop/products')}>
                                新增商品
                            </Button>
                            <Button icon={<SettingOutlined />} onClick={() => navigate('/material-shop/settings')}>
                                完善资料
                            </Button>
                        </Space>
                    )}
                />

                <MerchantStatGrid
                    items={[
                        {
                            label: '商品总数',
                            value: products.length,
                            meta: `有图 ${withImagesCount} · 可展示 ${readyProductsCount}`,
                            percent: (products.length / 20) * 100,
                            tone: 'blue',
                        },
                        {
                            label: '待完善商品',
                            value: pendingImproveCount,
                            meta: '缺图或缺描述需优先补齐',
                            percent: pendingImproveCount > 0 ? 100 : 0,
                            tone: pendingImproveCount > 0 ? 'amber' : 'green',
                        },
                        {
                            label: '已完善商品',
                            value: readyProductsCount,
                            meta: '有图且描述完整',
                            percent: products.length ? (readyProductsCount / products.length) * 100 : 0,
                            tone: readyProductsCount > 0 ? 'green' : 'slate',
                        },
                        {
                            label: '资料完整度',
                            value: `${profileCompletePercent}%`,
                            meta: '店铺资料补全后更利于后续运营接入',
                            percent: profileCompletePercent,
                            tone: profileCompletePercent >= 80 ? 'blue' : 'amber',
                        },
                        {
                            label: '建议上架目标',
                            value: remainingTargetCount,
                            meta: remainingTargetCount > 0 ? '建议先补齐到 20 个样品' : '已达到当前建议数量',
                            percent: remainingTargetCount > 0 ? ((20 - remainingTargetCount) / 20) * 100 : 100,
                            tone: remainingTargetCount > 0 ? 'amber' : 'green',
                        },
                    ]}
                />

                <MerchantContentPanel>
                    <Card className={styles.heroCard}>
                        <div className={styles.heroTitle}>今天优先处理什么？</div>
                        <div className={styles.heroDescription}>
                            先补齐商品图片与描述，再完善店铺资料。本期主材商中心不涉及售卖、订单、项目执行与资金结算，只保留资料维护与商品管理。
                        </div>
                    </Card>

                    <MerchantSectionCard title="快捷入口">
                        <div className={styles.actionGrid}>
                            {[
                                { icon: <AppstoreOutlined />, label: '商品管理', path: '/material-shop/products' },
                                { icon: <SettingOutlined />, label: '店铺设置', path: '/material-shop/settings' },
                            ].map((action) => (
                                <div key={action.path} className={styles.actionButton} onClick={() => navigate(action.path)} role="button" tabIndex={0}>
                                    <div className={styles.actionIcon}>{action.icon}</div>
                                    <div className={styles.actionText}>{action.label}</div>
                                </div>
                            ))}
                        </div>
                    </MerchantSectionCard>

                    <div className={styles.statsGrid}>
                        <MerchantSectionCard title="待办提醒">
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <Button type="link" className={styles.inlineLinkButton} onClick={() => navigate('/material-shop/products')}>
                                    待完善商品：{pendingImproveCount} 个
                                </Button>
                                <Button type="link" className={styles.inlineLinkButton} onClick={() => navigate('/material-shop/settings')}>
                                    资料完整度：{profileCompletePercent}%
                                </Button>
                                <Button type="link" className={styles.inlineLinkButton} onClick={() => navigate('/material-shop/products')}>
                                    建议上架补齐：{remainingTargetCount} 个
                                </Button>
                            </Space>
                        </MerchantSectionCard>

                        <MerchantSectionCard title="经营提示">
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                <div>有图商品 {withImagesCount} 个，可完整展示商品 {readyProductsCount} 个。</div>
                                <div>当前版本不开放报价、订单、项目执行和资金结算，避免提前暴露空能力。</div>
                                <div>通知能力暂不作为主材商中心主入口展示，优先把商品与资料维护稳定。</div>
                            </Space>
                        </MerchantSectionCard>
                    </div>
                </MerchantContentPanel>
            </MerchantPageShell>
        );
    }

    const providerSubType = String(provider?.providerSubType || '').toLowerCase();
    const applicantType = String(provider?.applicantType || '').toLowerCase();
    const isForeman = providerSubType === 'foreman';
    const isCompany = providerSubType === 'company' || applicantType === 'company';
    const roleTag = isForeman ? '工长' : isCompany ? '装修公司' : '设计师';

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

    const providerStatItems: MerchantStatItem[] = isForeman
        ? [
            {
                label: '待开工项目',
                value: Number(stats?.pendingLeads || 0),
                meta: '新分配线索',
                percent: Number(stats?.pendingLeads || 0) > 0 ? 100 : 0,
                tone: Number(stats?.pendingLeads || 0) > 0 ? 'amber' : 'slate',
            },
            {
                label: '进行中项目',
                value: Number(stats?.activeProjects || 0),
                meta: '施工推进中',
                percent: Number(stats?.activeProjects || 0) > 0 ? 100 : 0,
                tone: Number(stats?.activeProjects || 0) > 0 ? 'blue' : 'slate',
            },
            {
                label: '施工报价确认',
                value: Number(stats?.pendingProposals || 0),
                meta: '待确认报价/施工方案',
                percent: Number(stats?.pendingProposals || 0) > 0 ? 100 : 0,
                tone: Number(stats?.pendingProposals || 0) > 0 ? 'amber' : 'slate',
            },
            {
                label: '待验收项目',
                value: Number(stats?.todayBookings || 0),
                meta: '待处理验收节奏',
                percent: Number(stats?.todayBookings || 0) > 0 ? 100 : 0,
                tone: Number(stats?.todayBookings || 0) > 0 ? 'amber' : 'slate',
            },
            {
                label: '本月回款 / 可提现',
                value: `¥${(income?.availableAmount || 0).toLocaleString()}`,
                meta: `本月回款 ¥${(stats?.monthRevenue || 0).toLocaleString()}`,
                percent: income?.totalIncome ? (income.availableAmount / income.totalIncome) * 100 : 0,
                tone: 'green',
            },
        ]
        : isCompany
            ? [
                {
                    label: '待分配线索',
                    value: Number(stats?.pendingLeads || 0),
                    meta: '新线索待协同分配',
                    percent: Number(stats?.pendingLeads || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.pendingLeads || 0) > 0 ? 'amber' : 'slate',
                },
                {
                    label: '待确认预约',
                    value: Number(stats?.todayBookings || 0),
                    meta: '预约与到店安排',
                    percent: Number(stats?.todayBookings || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.todayBookings || 0) > 0 ? 'blue' : 'slate',
                },
                {
                    label: '待确认方案',
                    value: Number(stats?.pendingProposals || 0),
                    meta: '标准交付待推进',
                    percent: Number(stats?.pendingProposals || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.pendingProposals || 0) > 0 ? 'amber' : 'slate',
                },
                {
                    label: '进行中订单',
                    value: Number(stats?.activeProjects || 0),
                    meta: '企业履约推进中',
                    percent: Number(stats?.activeProjects || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.activeProjects || 0) > 0 ? 'blue' : 'slate',
                },
                {
                    label: '本月成交 / 可提现',
                    value: `¥${(income?.availableAmount || 0).toLocaleString()}`,
                    meta: `本月成交 ¥${(stats?.monthRevenue || 0).toLocaleString()}`,
                    percent: income?.totalIncome ? (income.availableAmount / income.totalIncome) * 100 : 0,
                    tone: 'green',
                },
            ]
            : [
                {
                    label: '待响应线索',
                    value: Number(stats?.pendingLeads || 0),
                    meta: '新分配需求待处理',
                    percent: Number(stats?.pendingLeads || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.pendingLeads || 0) > 0 ? 'amber' : 'slate',
                },
                {
                    label: '待确认预约',
                    value: Number(stats?.todayBookings || 0),
                    meta: '最近新增预约',
                    percent: Number(stats?.todayBookings || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.todayBookings || 0) > 0 ? 'blue' : 'slate',
                },
                {
                    label: '待确认方案',
                    value: Number(stats?.pendingProposals || 0),
                    meta: '设计方案转化中',
                    percent: Number(stats?.pendingProposals || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.pendingProposals || 0) > 0 ? 'amber' : 'slate',
                },
                {
                    label: '进行中项目',
                    value: Number(stats?.activeProjects || 0),
                    meta: '当前项目履约进度',
                    percent: Number(stats?.activeProjects || 0) > 0 ? 100 : 0,
                    tone: Number(stats?.activeProjects || 0) > 0 ? 'blue' : 'slate',
                },
                {
                    label: '本月收入 / 可提现',
                    value: `¥${(income?.availableAmount || 0).toLocaleString()}`,
                    meta: `本月收入 ¥${(stats?.monthRevenue || 0).toLocaleString()}`,
                    percent: income?.totalIncome ? (income.availableAmount / income.totalIncome) * 100 : 0,
                    tone: 'green',
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

    const providerTodos = isForeman
        ? [
            { label: '待开工项目', value: Number(stats?.pendingLeads || 0), path: '/leads' },
            { label: '施工报价确认', value: Number(stats?.pendingProposals || 0), path: '/proposals' },
            { label: '待验收项目', value: Number(stats?.todayBookings || 0), path: '/projects' },
        ]
        : isCompany
            ? [
                { label: '待分配线索', value: Number(stats?.pendingLeads || 0), path: '/leads' },
                { label: '待确认预约', value: Number(stats?.todayBookings || 0), path: '/bookings' },
                { label: '待确认方案', value: Number(stats?.pendingProposals || 0), path: '/proposals' },
            ]
            : [
                { label: '待响应线索', value: Number(stats?.pendingLeads || 0), path: '/leads' },
                { label: '待确认预约', value: Number(stats?.todayBookings || 0), path: '/bookings' },
                { label: '待确认方案', value: Number(stats?.pendingProposals || 0), path: '/proposals' },
            ];

    const providerTips = isForeman
        ? [
            '优先确认施工报价与开工节奏，避免施工排期断档。',
            '项目执行页已纳入节点与验收闭环，施工日志要持续补齐。',
            '工长价格库与施工案例应保持同步更新，避免承接信息失真。',
        ]
        : isCompany
            ? [
                '优先处理待分配线索和待确认预约，避免企业协同断点。',
                '公司案例与品牌介绍应持续更新，突出团队与交付能力。',
                '方案与订单节奏统一从工作台推进，减少多页面来回切换。',
            ]
            : [
                '优先跟进高意向线索和预约，减少设计转化等待时间。',
                '作品集与服务介绍需要保持更新，避免展示信息滞后。',
                '方案确认和项目推进统一回到工作台，不再依赖分散入口。',
            ];

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title={dashboardTitle}
                description={dashboardSubtitle}
                meta={(
                    <>
                        <Tag color="blue">{roleTag}</Tag>
                        <span className={styles.mutedNote}>{dayjs().format('YYYY年M月D日 · dddd')}</span>
                    </>
                )}
                extra={(
                    <Space>
                        {isForeman ? (
                            <Button icon={<DollarOutlined />} onClick={() => navigate('/price-book')}>
                                工长价格库
                            </Button>
                        ) : (
                            <Button icon={<FileTextOutlined />} onClick={() => navigate('/proposals')}>
                                {isCompany ? '方案协同' : '方案管理'}
                            </Button>
                        )}
                        <Button
                            type="primary"
                            icon={<ProjectOutlined />}
                            onClick={() => navigate(isForeman ? '/projects' : (isCompany ? '/orders' : '/bookings'))}
                        >
                            {isForeman ? '进入项目执行' : isCompany ? '查看订单协同' : '查看预约进度'}
                        </Button>
                    </Space>
                )}
            />

            <MerchantStatGrid items={providerStatItems} />

            <MerchantContentPanel>
                <Card className={styles.heroCard}>
                    <div className={styles.heroTitle}>今天优先处理什么？</div>
                    <div className={styles.heroDescription}>
                        {isForeman
                            ? `先跟进待开工项目与施工报价，再推进项目执行和验收。当前进行中项目 ${Number(stats?.activeProjects || 0)} 个。`
                            : isCompany
                                ? `先处理待分配线索、待确认预约与方案，再统一推进企业订单协同。当前进行中订单 ${Number(stats?.activeProjects || 0)} 个。`
                                : `先处理高意向线索、预约和待确认方案，再补齐作品展示与服务资料。当前进行中项目 ${Number(stats?.activeProjects || 0)} 个。`}
                    </div>
                </Card>

                <MerchantSectionCard title="快捷入口">
                    <div className={styles.actionGrid}>
                        {quickActions.map((action) => (
                            <div key={action.path} className={styles.actionButton} onClick={() => navigate(action.path)} role="button" tabIndex={0}>
                                <div className={styles.actionIcon}>{action.icon}</div>
                                <div className={styles.actionText}>{action.label}</div>
                            </div>
                        ))}
                    </div>
                </MerchantSectionCard>

                <div className={styles.statsGrid}>
                    <MerchantSectionCard title="待办提醒">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {providerTodos.map((item) => (
                                <Button key={item.label} type="link" className={styles.inlineLinkButton} onClick={() => navigate(item.path)}>
                                    {item.label}：{item.value}
                                </Button>
                            ))}
                        </Space>
                    </MerchantSectionCard>

                    <MerchantSectionCard title="经营提示">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {providerTips.map((item) => (
                                <div key={item}>{item}</div>
                            ))}
                        </Space>
                    </MerchantSectionCard>

                    <MerchantSectionCard title="资金动作">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Button onClick={() => navigate('/income')}>查看收入明细</Button>
                            <Button type="primary" onClick={() => navigate('/withdraw')} disabled={!income?.availableAmount}>申请提现</Button>
                            <Button onClick={() => navigate('/bank-accounts')}>管理银行卡</Button>
                        </Space>
                    </MerchantSectionCard>
                </div>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantDashboard;
