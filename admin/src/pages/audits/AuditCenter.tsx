import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty } from 'antd';
import { Link } from 'react-router-dom';
import {
    adminIdentityApplicationApi,
    adminMaterialShopApplicationApi,
    adminMerchantApplicationApi,
    caseAuditApi,
    type AdminApiResponse,
    type AdminListData,
    type AdminMaterialShopApplicationListItem,
    type AdminMerchantApplicationListItem,
    type IdentityApplicationItem,
} from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusTag from '../../components/StatusTag';
import { AuditOutlined, CheckCircleOutlined, FileImageOutlined, ShopOutlined } from '@ant-design/icons';
import { AUDIT_MODULE_OPTIONS, PROVIDER_ROLE_META } from '../../constants/statuses';
import { formatServerDateTime, getServerTimeMs } from '../../utils/serverTime';

type AuditModuleKey = 'all' | 'provider' | 'material' | 'identity' | 'case';

type AuditModuleState<T> = {
    loading: boolean;
    error: string;
    pendingCount: number;
    items: T[];
};

interface CaseAuditListItem {
    id: number;
    providerName: string;
    title: string;
    createdAt: string;
    status: number;
}

interface QueueItem {
    key: string;
    module: Exclude<AuditModuleKey, 'all'>;
    name: string;
    moduleLabel: string;
    badgeId: string;
    description: string;
    submittedAt: string;
    path: string;
    avatarText: string;
}

const defaultModuleState = <T,>(): AuditModuleState<T> => ({
    loading: true,
    error: '',
    pendingCount: 0,
    items: [],
});

const formatDateTime = formatServerDateTime;

const readErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
        return error.message || fallback;
    }
    return fallback;
};

const wrapSuccessButtonStyle: React.CSSProperties = {
    background: '#059669',
    borderColor: '#059669',
    color: '#fff',
};

const wrapDangerButtonStyle: React.CSSProperties = {
    color: '#dc2626',
    borderColor: 'rgba(220,38,38,0.24)',
};

const AuditCenter: React.FC = () => {
    const { hasPermission } = usePermission();

    const [providerState, setProviderState] = useState<AuditModuleState<AdminMerchantApplicationListItem>>(defaultModuleState);
    const [materialState, setMaterialState] = useState<AuditModuleState<AdminMaterialShopApplicationListItem>>(defaultModuleState);
    const [identityState, setIdentityState] = useState<AuditModuleState<IdentityApplicationItem>>(defaultModuleState);
    const [caseState, setCaseState] = useState<AuditModuleState<CaseAuditListItem>>(defaultModuleState);
    const [activeTab, setActiveTab] = useState<AuditModuleKey>('all');

    const canProvider = hasPermission('provider:audit:list');
    const canMaterial = hasPermission('material:audit:list');
    const canIdentity = hasPermission('identity:application:audit');
    const canCase = hasPermission('system:case:view');

    const fetchProvider = useCallback(async () => {
        setProviderState((prev) => ({ ...prev, loading: true, error: '' }));
        try {
            const res = await adminMerchantApplicationApi.list({ status: 0, page: 1, pageSize: 6 });
            if (res.code !== 0) {
                throw new Error(res.message || '加载失败');
            }
            setProviderState({
                loading: false,
                error: '',
                pendingCount: res.data?.total || 0,
                items: res.data?.list || [],
            });
        } catch (error) {
            setProviderState({ loading: false, error: readErrorMessage(error, '加载失败'), pendingCount: 0, items: [] });
        }
    }, []);

    const fetchMaterial = useCallback(async () => {
        setMaterialState((prev) => ({ ...prev, loading: true, error: '' }));
        try {
            const res = await adminMaterialShopApplicationApi.list({ status: 0, page: 1, pageSize: 6 });
            if (res.code !== 0) {
                throw new Error(res.message || '加载失败');
            }
            setMaterialState({
                loading: false,
                error: '',
                pendingCount: res.data?.total || 0,
                items: res.data?.list || [],
            });
        } catch (error) {
            setMaterialState({ loading: false, error: readErrorMessage(error, '加载失败'), pendingCount: 0, items: [] });
        }
    }, []);

    const fetchIdentity = useCallback(async () => {
        setIdentityState((prev) => ({ ...prev, loading: true, error: '' }));
        try {
            const res = await adminIdentityApplicationApi.list({ status: 0, page: 1, pageSize: 6 }) as unknown as AdminApiResponse<AdminListData<IdentityApplicationItem>>;
            if (res.code !== 0) {
                throw new Error(res.message || '加载失败');
            }
            setIdentityState({
                loading: false,
                error: '',
                pendingCount: res.data?.total || 0,
                items: res.data?.list || [],
            });
        } catch (error) {
            setIdentityState({ loading: false, error: readErrorMessage(error, '加载失败'), pendingCount: 0, items: [] });
        }
    }, []);

    const fetchCase = useCallback(async () => {
        setCaseState((prev) => ({ ...prev, loading: true, error: '' }));
        try {
            const res = await caseAuditApi.list({ status: 0, page: 1, pageSize: 6 }) as unknown as AdminApiResponse<AdminListData<CaseAuditListItem>>;
            if (res.code !== 0) {
                throw new Error(res.message || '加载失败');
            }
            setCaseState({
                loading: false,
                error: '',
                pendingCount: res.data?.total || 0,
                items: res.data?.list || [],
            });
        } catch (error) {
            setCaseState({ loading: false, error: readErrorMessage(error, '加载失败'), pendingCount: 0, items: [] });
        }
    }, []);

    useEffect(() => {
        if (canProvider) {
            void fetchProvider();
        } else {
            setProviderState({ loading: false, error: '', pendingCount: 0, items: [] });
        }

        if (canMaterial) {
            void fetchMaterial();
        } else {
            setMaterialState({ loading: false, error: '', pendingCount: 0, items: [] });
        }

        if (canIdentity) {
            void fetchIdentity();
        } else {
            setIdentityState({ loading: false, error: '', pendingCount: 0, items: [] });
        }

        if (canCase) {
            void fetchCase();
        } else {
            setCaseState({ loading: false, error: '', pendingCount: 0, items: [] });
        }
    }, [canCase, canIdentity, canMaterial, canProvider, fetchCase, fetchIdentity, fetchMaterial, fetchProvider]);

    const queueItems = useMemo<QueueItem[]>(() => {
        const providerItems = providerState.items.map((item) => ({
            key: `provider-${item.id}`,
            module: 'provider' as const,
            name: item.companyName || item.realName || item.phone,
            moduleLabel: '服务类商家入驻',
            badgeId: `#${item.id}`,
            description: `申请认证为${PROVIDER_ROLE_META[item.role]?.text || item.role || '服务类商家'}，提交了相关资质材料，请审核。`,
            submittedAt: item.createdAt,
            path: '/providers/audit',
            avatarText: (item.realName || item.companyName || item.phone || '申').slice(0, 1),
        }));

        const materialItems = materialState.items.map((item) => ({
            key: `material-${item.id}`,
            module: 'material' as const,
            name: item.shopName || item.companyName || item.contactName || item.phone,
            moduleLabel: '主材商入驻',
            badgeId: `#${item.id}`,
            description: `申请入驻为主材商，提交了营业执照与门店资料，请审核。`,
            submittedAt: item.createdAt,
            path: '/materials/audit',
            avatarText: (item.contactName || item.shopName || item.phone || '材').slice(0, 1),
        }));

        const identityItems = identityState.items.map((item) => ({
            key: `identity-${item.id}`,
            module: 'identity' as const,
            name: item.merchantDetails?.companyName || item.merchantDetails?.realName || `用户 #${item.userId}`,
            moduleLabel: '身份申请',
            badgeId: `#${item.id}`,
            description: `申请认证为${PROVIDER_ROLE_META[item.providerSubType || '']?.text || item.providerSubType || '新身份'}，请审核。`,
            submittedAt: item.appliedAt,
            path: '/audits/identity-applications',
            avatarText: (item.merchantDetails?.realName || item.merchantDetails?.companyName || '身').slice(0, 1),
        }));

        const caseItems = caseState.items.map((item) => ({
            key: `case-${item.id}`,
            module: 'case' as const,
            name: item.providerName || item.title || `案例 #${item.id}`,
            moduleLabel: '案例审核',
            badgeId: `#${item.id}`,
            description: `提交了作品《${item.title || '未命名案例'}》的审核申请，请尽快处理。`,
            submittedAt: item.createdAt,
            path: '/cases/manage',
            avatarText: (item.providerName || item.title || '案').slice(0, 1),
        }));

        return [...providerItems, ...materialItems, ...identityItems, ...caseItems]
            .sort((left, right) => getServerTimeMs(right.submittedAt) - getServerTimeMs(left.submittedAt));
    }, [caseState.items, identityState.items, materialState.items, providerState.items]);

    const filteredQueueItems = useMemo(() => {
        if (activeTab === 'all') {
            return queueItems;
        }
        return queueItems.filter((item) => item.module === activeTab);
    }, [activeTab, queueItems]);

    const totalPending = providerState.pendingCount + materialState.pendingCount + identityState.pendingCount + caseState.pendingCount;

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="审核中心"
                description="统一查看各审核模块的待处理队列，并快速进入对应审核页。"
            />

            <div className="hz-audit-summary">
                <StatCard title="待审核" value={totalPending} icon={<AuditOutlined />} tone="warning" />
                <StatCard title="服务类商家入驻" value={providerState.pendingCount} icon={<ShopOutlined />} tone="accent" />
                <StatCard title="身份 / 主材" value={identityState.pendingCount + materialState.pendingCount} icon={<CheckCircleOutlined />} tone="success" />
                <StatCard title="案例审核" value={caseState.pendingCount} icon={<FileImageOutlined />} tone="danger" />
            </div>

            <div className="hz-audit-tabs" role="tablist" aria-label="审核中心筛选">
                {AUDIT_MODULE_OPTIONS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`hz-audit-tab${activeTab === item.key ? ' hz-audit-tab--active' : ''}`}
                        onClick={() => setActiveTab(item.key)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="hz-audit-queue">
                {filteredQueueItems.length ? filteredQueueItems.map((item) => (
                    <div key={item.key} className="hz-audit-queue__item">
                        <span className="hz-audit-queue__avatar">{item.avatarText}</span>

                        <div className="hz-audit-queue__main">
                            <div className="hz-audit-queue__title">
                                <span className="hz-audit-queue__name">{item.name}</span>
                                <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>{item.badgeId}</span>
                                <StatusTag status="pending" />
                            </div>
                            <div className="hz-audit-queue__desc">{item.description}</div>
                            <div className="hz-audit-queue__meta">
                                <span>{item.moduleLabel}</span>
                                <span>{formatDateTime(item.submittedAt)}</span>
                            </div>
                        </div>

                        <div className="hz-audit-queue__actions">
                            <Link to={item.path}>
                                <Button block style={wrapSuccessButtonStyle}>
                                    进入审核
                                </Button>
                            </Link>
                            <Link to={item.path}>
                                <Button block danger ghost style={wrapDangerButtonStyle}>
                                    查看资料
                                </Button>
                            </Link>
                        </div>
                    </div>
                )) : (
                    <Card className="hz-panel-card hz-audit-queue__empty">
                        <Empty description="当前筛选下暂无待处理审核项" />
                    </Card>
                )}
            </div>
        </div>
    );
};

export default AuditCenter;
