import React, { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import {
    AppstoreOutlined,
    SettingOutlined,
    WalletOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import MerchantPageShell from '../../components/MerchantPageShell';
import styles from './MerchantDashboard.module.css';
import {
    materialShopCenterApi,
    merchantAuthApi,
    merchantBookingApi,
    merchantDashboardApi,
    merchantIncomeApi,
    type MaterialShopProduct,
    type MaterialShopProfile,
    type MerchantBookingEntry,
    type MerchantDashboardStats,
    type MerchantIncomeSummary,
    type MerchantProviderInfo,
} from '../../services/merchantApi';
import { useMerchantAuthStore } from '../../stores/merchantAuthStore';
import { resolveDisplayStatusMeta } from '../../utils/displayStatus';

type DashboardMetricTone = 'accent' | 'warning' | 'success' | 'neutral';

type DashboardMetric = {
    label: string;
    value: string | number;
    note: string;
    tone?: DashboardMetricTone;
};

type DashboardTask = {
    label: string;
    value: string | number;
    hint: string;
    path: string;
    actionLabel?: string;
};

type DashboardAction = {
    icon: React.ReactNode;
    label: string;
    hint: string;
    path: string;
    emphasis?: boolean;
};

type DashboardModel = {
    roleTag: string;
    title: string;
    subtitle?: string;
    statusLabel: string;
    statusTone: 'slate' | 'blue' | 'green' | 'amber' | 'red';
    statusHelper: string;
    metrics: DashboardMetric[];
    tasks: DashboardTask[];
    secondaryActions: DashboardAction[];
};

const PROPOSAL_WORKFLOW_STAGES = new Set([
    'survey_deposit_pending',
    'negotiating',
    'design_quote_pending',
    'design_fee_paying',
    'design_pending_submission',
    'design_delivery_pending',
    'design_acceptance_pending',
    'design_pending_confirmation',
]);

const isProposalWorkflowBooking = (booking: MerchantBookingEntry) => {
    const stage = String(booking.currentStage || '').trim().toLowerCase();
    if (!stage) {
        return Boolean(booking.hasProposal) || (booking.availableActions || []).some((action) => (
            action === 'submit_site_survey'
            || action === 'submit_budget'
            || action === 'create_design_fee_quote'
            || action === 'create_proposal'
            || action === 'submit_design_delivery'
        ));
    }
    return PROPOSAL_WORKFLOW_STAGES.has(stage);
};

function formatCurrency(value: number) {
    return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

function compactText(text: string | undefined, fallback: string) {
    const normalized = String(text || '').trim();
    if (!normalized) {
        return fallback;
    }
    const sentence = normalized.match(/^[^。！？!?]+[。！？!?]?/u)?.[0]?.trim();
    return sentence || normalized;
}

function renderMetricValue(value: string | number) {
    return typeof value === 'number' ? value.toLocaleString('zh-CN') : value;
}

const MerchantDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MerchantDashboardStats | null>(null);
    const [income, setIncome] = useState<MerchantIncomeSummary | null>(null);
    const [bookings, setBookings] = useState<MerchantBookingEntry[]>([]);
    const [products, setProducts] = useState<MaterialShopProduct[]>([]);
    const [profileCompletePercent, setProfileCompletePercent] = useState(0);
    const [providerInfo, setProviderInfo] = useState<MerchantProviderInfo | null>(null);
    const [materialProfile, setMaterialProfile] = useState<MaterialShopProfile | null>(null);
    const navigate = useNavigate();
    const provider = useMerchantAuthStore((state) => state.provider);

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
                    setMaterialProfile(profile);
                    const fields = [
                        profile.shopName,
                        profile.companyName,
                        profile.shopDescription,
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

            const [statsRes, incomeRes, infoRes, bookingRes] = await Promise.allSettled([
                merchantDashboardApi.stats(),
                merchantIncomeApi.summary(),
                merchantAuthApi.getInfo(),
                merchantBookingApi.list(),
            ]);

            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value);
            }
            if (incomeRes.status === 'fulfilled') {
                setIncome(incomeRes.value);
            }
            if (infoRes.status === 'fulfilled') {
                setProviderInfo(infoRes.value);
            }

            if (bookingRes.status === 'fulfilled') {
                setBookings(bookingRes.value.list || []);
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
            <div className={styles.loadingWrap} role="status" aria-live="polite">
                <Spin size="large" />
                <span className={styles.srOnly}>正在加载工作台数据</span>
            </div>
        );
    }

    const materialStatusMeta = resolveDisplayStatusMeta(materialProfile, {
        activeLabel: '营业中',
        settingsPath: '/material-shop/settings',
        workflowPath: '/material-shop/products',
    });

    const providerStatusMeta = resolveDisplayStatusMeta(providerInfo || provider, {
        activeLabel: '接单中',
        settingsPath: '/settings',
        workflowPath: '/bookings',
    });

    const providerSubType = String(provider?.providerSubType || '').toLowerCase();
    const isForeman = providerSubType === 'foreman';
    const isCompany = providerSubType === 'company';
    const proposalWorkflowBookings = bookings.filter(isProposalWorkflowBooking);
    const proposalWorkflowCount = proposalWorkflowBookings.length;
    const proposalWorkflowPath = proposalWorkflowBookings[0]
        ? `/proposals/flow/${proposalWorkflowBookings[0].id}`
        : '/proposals';

    const missingImagesCount = products.filter((item) => !(item.images || []).length).length;
    const missingDescriptionCount = products.filter((item) => !String(item.description || '').trim()).length;
    const readyProductsCount = products.filter((item) => (item.images || []).length > 0 && String(item.description || '').trim()).length;
    const pendingImproveCount = missingImagesCount + missingDescriptionCount;
    const remainingTargetCount = Math.max(0, 20 - products.length);

    const dashboardModel: DashboardModel = isMaterialShop
        ? {
            roleTag: '主材商',
            title: '店铺概览',
            statusLabel: materialStatusMeta.label,
            statusTone: materialStatusMeta.tone,
            statusHelper: compactText(materialStatusMeta.helperText, '当前可继续维护商品与店铺资料。'),
            metrics: [
                { label: '商品总数', value: products.length, note: '建议控制在 20 个以内', tone: 'accent' },
                { label: '可展示商品', value: readyProductsCount, note: '图文齐全', tone: readyProductsCount > 0 ? 'success' : 'neutral' },
                { label: '待完善商品', value: pendingImproveCount, note: '缺图或缺描述', tone: pendingImproveCount > 0 ? 'warning' : 'neutral' },
                { label: '资料完整度', value: `${profileCompletePercent}%`, note: '店铺基础资料', tone: profileCompletePercent >= 80 ? 'success' : 'warning' },
            ],
            tasks: [
                { label: '待完善商品', value: pendingImproveCount, hint: '先补图片和描述', path: '/material-shop/products', actionLabel: '去处理' },
                { label: '资料完整度', value: `${profileCompletePercent}%`, hint: '资料尽量补齐', path: '/material-shop/settings', actionLabel: '去完善' },
                { label: '建议补齐商品', value: remainingTargetCount, hint: '补到合理陈列规模', path: '/material-shop/products', actionLabel: '去添加' },
            ],
            secondaryActions: [
                { icon: <WalletOutlined />, label: '财务中心', hint: `可提现 ${formatCurrency(income?.availableAmount || 0)}`, path: '/income', emphasis: true },
                { icon: <AppstoreOutlined />, label: '商品列表', hint: `当前 ${products.length} 个商品`, path: '/material-shop/products' },
            ],
        }
        : {
            roleTag: isForeman ? '工长' : isCompany ? '装修公司' : '设计师',
            title: '今日重点',
            statusLabel: providerStatusMeta.label,
            statusTone: providerStatusMeta.tone,
            statusHelper: compactText(
                providerStatusMeta.helperText,
                isForeman ? '当前可继续承接施工机会。' : '当前可继续推进主链路。',
            ),
            metrics: isForeman
                ? [
                    { label: '待接施工机会', value: Number(stats?.pendingLeads || 0), note: '先判断是否承接', tone: Number(stats?.pendingLeads || 0) > 0 ? 'warning' : 'neutral' },
                    { label: '待转施工报价', value: Number(stats?.pendingProposals || 0), note: '正式进入报价', tone: Number(stats?.pendingProposals || 0) > 0 ? 'warning' : 'neutral' },
                    { label: '项目履约中', value: Number(stats?.activeProjects || 0), note: '施工与验收推进', tone: Number(stats?.activeProjects || 0) > 0 ? 'accent' : 'neutral' },
                    { label: '待验收推进', value: Number(stats?.todayBookings || 0), note: '盯关键节点', tone: Number(stats?.todayBookings || 0) > 0 ? 'accent' : 'neutral' },
                ]
                : [
                    { label: isCompany ? '待推进线索' : '待响应线索', value: Number(stats?.pendingLeads || 0), note: '先判断是否接手', tone: Number(stats?.pendingLeads || 0) > 0 ? 'warning' : 'neutral' },
                    { label: '方案流程待推进', value: proposalWorkflowCount, note: '量房、沟通、报价、交付链路', tone: proposalWorkflowCount > 0 ? 'accent' : 'neutral' },
                    { label: '待确认方案', value: Number(stats?.pendingProposals || 0), note: '用户确认中的方案', tone: Number(stats?.pendingProposals || 0) > 0 ? 'warning' : 'neutral' },
                    { label: isCompany ? '项目总览' : '已转项目', value: Number(stats?.activeProjects || 0), note: '只看已转项目', tone: Number(stats?.activeProjects || 0) > 0 ? 'success' : 'neutral' },
                ],
            tasks: isForeman
                ? [
                    { label: '待接施工机会', value: Number(stats?.pendingLeads || 0), hint: '先做承接判断', path: '/bookings', actionLabel: '去查看' },
                    { label: '待转施工报价', value: Number(stats?.pendingProposals || 0), hint: '把报价推进到确认', path: '/proposals', actionLabel: '去推进' },
                    { label: '项目履约中', value: Number(stats?.activeProjects || 0), hint: '持续盯开工和验收', path: '/projects', actionLabel: '去查看' },
                ]
                : [
                    { label: isCompany ? '待推进线索' : '待响应线索', value: Number(stats?.pendingLeads || 0), hint: '先看新进入的机会', path: '/bookings', actionLabel: '去处理' },
                    { label: '方案流程待推进', value: proposalWorkflowCount, hint: '继续推进量房、沟通、报价或交付', path: proposalWorkflowPath, actionLabel: '去推进' },
                    { label: '待确认方案', value: Number(stats?.pendingProposals || 0), hint: '查看等待用户确认的方案', path: '/proposals', actionLabel: '去查看' },
                ],
            secondaryActions: [
                { icon: <WalletOutlined />, label: '财务中心', hint: `可提现 ${formatCurrency(income?.availableAmount || 0)}`, path: '/income', emphasis: true },
                { icon: <AppstoreOutlined />, label: '内容资产', hint: isForeman ? '工艺与案例内容' : '案例与作品管理', path: '/cases' },
                { icon: <SettingOutlined />, label: '资料设置', hint: '维护对外资料', path: '/settings' },
            ],
        };

    return (
        <MerchantPageShell className={styles.shell}>
            <div className={styles.page}>
                <section className={styles.heroPanel}>
                    <div className={styles.heroTopRow}>
                        <div className={styles.heroMain}>
                            <div className={styles.heroMetaRow}>
                                <span className={styles.roleBadge}>{dashboardModel.roleTag}</span>
                                <span className={styles.dateText}>{dayjs().format('YYYY年M月D日')}</span>
                            </div>
                            <h1 className={styles.heroTitle}>{dashboardModel.title}</h1>
                            {dashboardModel.subtitle ? (
                                <p className={styles.heroSubtitle}>{dashboardModel.subtitle}</p>
                            ) : null}
                        </div>

                        <div className={styles.heroAside}>
                            <div className={styles.heroStatusCard} data-tone={dashboardModel.statusTone}>
                                <span className={styles.heroStatusLabel}>{isMaterialShop ? '营业状态' : '接单状态'}</span>
                                <strong className={styles.heroStatusValue}>{dashboardModel.statusLabel}</strong>
                                <p className={styles.heroStatusText}>{dashboardModel.statusHelper}</p>
                            </div>
                        </div>
                    </div>

                    <div className={styles.metricGrid}>
                        {dashboardModel.metrics.map((item) => (
                            <article key={item.label} className={styles.metricCard} data-tone={item.tone || 'neutral'}>
                                <span className={styles.metricLabel}>{item.label}</span>
                                <strong className={styles.metricValue}>{renderMetricValue(item.value)}</strong>
                                <span className={styles.metricNote}>{item.note}</span>
                            </article>
                        ))}
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelHead}>
                        <div>
                            <h2>当前优先</h2>
                        </div>
                    </div>

                    <div className={styles.taskList}>
                        {dashboardModel.tasks.map((item) => (
                            <button
                                key={item.label}
                                type="button"
                                className={styles.taskRow}
                                onClick={() => navigate(item.path)}
                            >
                                <div className={styles.taskMain}>
                                    <span className={styles.taskLabel}>{item.label}</span>
                                    <span className={styles.taskHint}>{item.hint}</span>
                                </div>
                                <div className={styles.taskAside}>
                                    <strong className={styles.taskValue}>{renderMetricValue(item.value)}</strong>
                                    <span className={styles.taskAction}>{item.actionLabel || '去查看'}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className={styles.panel}>
                    <div className={styles.panelHead}>
                        <div>
                            <h2>更多入口</h2>
                        </div>
                    </div>

                    <div className={styles.entryGrid}>
                        {dashboardModel.secondaryActions.map((action) => (
                            <button
                                key={action.path}
                                type="button"
                                className={styles.secondaryAction}
                                data-emphasis={action.emphasis ? 'true' : 'false'}
                                onClick={() => navigate(action.path)}
                            >
                                <span className={styles.secondaryIcon}>{action.icon}</span>
                                <span className={styles.secondaryCopy}>
                                    <strong>{action.label}</strong>
                                    <span>{action.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </MerchantPageShell>
    );
};

export default MerchantDashboard;
