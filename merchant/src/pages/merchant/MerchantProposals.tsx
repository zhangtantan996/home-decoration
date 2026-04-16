import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeftOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import {
    Button,
    Empty,
    Input,
    Space,
    Table,
    Tag,
    Typography,
    message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import {
    merchantBookingApi,
    merchantProposalApi,
    type MerchantBookingEntry,
} from '../../services/merchantApi';
import { formatServerDateTime } from '../../utils/serverTime';
import styles from './MerchantProposals.module.css';

const { Search } = Input;
const { Text } = Typography;

interface Proposal {
    id: number;
    bookingId: number;
    summary?: string;
    designFee?: number;
    estimatedDays?: number;
    status: number;
    createdAt?: string;
}

type WorkspaceFilterKey =
    | 'all'
    | 'survey'
    | 'budget'
    | 'quote'
    | 'delivery'
    | 'confirm'
    | 'construction_prep'
    | 'construction_quote';

type WorkspaceStageKey = Exclude<WorkspaceFilterKey, 'all'>;

type ProposalWorkspaceRow = {
    key: string;
    bookingId: number;
    title: string;
    meta: string;
    supplementary?: string;
    stageKey: WorkspaceStageKey;
    stageLabel: string;
    statusLabel: string;
    statusColor: string;
    nextActionText: string;
    updatedAt?: string;
    flowPath: string;
};

const FILTERS: Array<{ key: WorkspaceFilterKey; label: string }> = [
    { key: 'all', label: '全部' },
    { key: 'survey', label: '量房资料' },
    { key: 'budget', label: '沟通确认' },
    { key: 'quote', label: '设计费报价' },
    { key: 'delivery', label: '设计交付' },
    { key: 'confirm', label: '用户确认' },
    { key: 'construction_prep', label: '施工报价准备' },
    { key: 'construction_quote', label: '施工主体选择 / 施工移交' },
];

const PROJECT_DOMAIN_STAGES = new Set([
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'case_pending_generation',
    'archived',
    'disputed',
    'payment_paused',
]);

const STAGE_LABELS: Record<WorkspaceStageKey, string> = {
    survey: '量房资料',
    budget: '沟通确认',
    quote: '设计费报价',
    delivery: '设计交付',
    confirm: '用户确认',
    construction_prep: '施工报价准备',
    construction_quote: '施工主体选择 / 施工移交',
};

const STAGE_ORDER: Record<WorkspaceStageKey, number> = {
    survey: 10,
    budget: 20,
    quote: 30,
    delivery: 40,
    confirm: 50,
    construction_prep: 60,
    construction_quote: 70,
};

const normalizeStage = (value?: string) => String(value || '').trim().toLowerCase();

const hasAnyAction = (booking: MerchantBookingEntry | undefined, actions: string[]) =>
    actions.some((action) => (booking?.availableActions || []).includes(action));

const isProposalWorkspaceBooking = (booking: MerchantBookingEntry) => {
    const stage = normalizeStage(booking.currentStage);
    if (booking.statusGroup === 'pending_confirmation' || booking.statusGroup === 'cancelled' || booking.status === 4) {
        return false;
    }
    if (stage === 'lead_pending' || stage === 'cancelled' || PROJECT_DOMAIN_STAGES.has(stage)) {
        return false;
    }
    if (stage) {
        return true;
    }
    if (booking.statusGroup === 'pending_payment' || booking.statusGroup === 'in_service') {
        return true;
    }
    return booking.hasProposal || (booking.availableActions || []).length > 0;
};

const buildFlowPath = (booking: MerchantBookingEntry) => {
    return `/proposals/flow/${booking.id}`;
};

const buildWorkspaceStageKey = (
    booking?: MerchantBookingEntry,
    proposal?: Proposal,
): WorkspaceStageKey => {
    const stage = normalizeStage(booking?.currentStage);

    if (hasAnyAction(booking, ['submit_site_survey']) || stage === 'survey_deposit_pending') {
        return 'survey';
    }
    if (hasAnyAction(booking, ['submit_budget']) || stage === 'negotiating') {
        return 'budget';
    }
    if (hasAnyAction(booking, ['create_design_fee_quote', 'submit_design_quote']) || stage === 'design_quote_pending' || stage === 'design_fee_paying') {
        return 'quote';
    }
    if (
        hasAnyAction(booking, ['create_proposal', 'submit_design_delivery'])
        || stage === 'design_pending_submission'
        || stage === 'design_delivery_pending'
    ) {
        return 'delivery';
    }
    if (proposal?.status === 3 || proposal?.status === 1 || stage === 'design_pending_confirmation') {
        return 'confirm';
    }
    if (stage === 'design_acceptance_pending') {
        return 'delivery';
    }
    if (hasAnyAction(booking, ['submit_quote_baseline', 'create_quote_task', 'select_constructor']) || stage === 'construction_party_pending') {
        return 'construction_prep';
    }
    if (hasAnyAction(booking, ['submit_construction_quote']) || stage === 'construction_quote_pending') {
        return 'construction_quote';
    }
    return 'confirm';
};

const buildStatusMeta = (
    booking: MerchantBookingEntry,
    proposal: Proposal | undefined,
    stageKey: WorkspaceStageKey,
) => {
    if (proposal?.status === 3) {
        return { label: '已退回', color: 'error' };
    }
    if (proposal?.status === 1 && stageKey === 'confirm') {
        return { label: '待用户确认', color: 'processing' };
    }

    if (hasAnyAction(booking, ['submit_site_survey'])) {
        return { label: '待提交', color: 'gold' };
    }
    if (hasAnyAction(booking, ['submit_budget'])) {
        return { label: '待提交', color: 'gold' };
    }
    if (hasAnyAction(booking, ['create_design_fee_quote', 'submit_design_quote'])) {
        return { label: '待报价', color: 'gold' };
    }
    if (hasAnyAction(booking, ['create_proposal', 'submit_design_delivery'])) {
        return { label: '待提交', color: 'gold' };
    }
    if (hasAnyAction(booking, ['submit_quote_baseline', 'create_quote_task', 'select_constructor'])) {
        return { label: '待整理', color: 'processing' };
    }
    if (hasAnyAction(booking, ['submit_construction_quote'])) {
        return { label: '推进中', color: 'processing' };
    }

    switch (stageKey) {
        case 'survey':
            return booking.statusGroup === 'pending_payment'
                ? { label: '待支付量房费', color: 'gold' }
                : { label: '待上传量房资料', color: 'processing' };
        case 'budget':
            return { label: '待用户确认', color: 'processing' };
        case 'quote':
            return normalizeStage(booking.currentStage) === 'design_fee_paying'
                ? { label: '待支付设计费', color: 'gold' }
                : { label: '待发起报价', color: 'processing' };
        case 'delivery':
            return { label: '待提交设计交付', color: 'processing' };
        case 'confirm':
            return { label: '待用户确认', color: 'processing' };
        case 'construction_prep':
            return { label: '待整理', color: 'processing' };
        case 'construction_quote':
            return { label: '推进中', color: 'processing' };
        default:
            return { label: booking.currentStageText || booking.statusText || '处理中', color: 'default' };
    }
};

const buildNextActionText = (
    booking: MerchantBookingEntry,
    proposal: Proposal | undefined,
    stageKey: WorkspaceStageKey,
) => {
    if (hasAnyAction(booking, ['submit_site_survey'])) return '上传量房资料';
    if (hasAnyAction(booking, ['submit_budget'])) return '提交沟通确认';
    if (hasAnyAction(booking, ['create_design_fee_quote', 'submit_design_quote'])) return '发起设计费报价';
    if (hasAnyAction(booking, ['create_proposal', 'submit_design_delivery'])) return '提交设计交付';
    if (proposal?.status === 3) return '重新提交正式方案';
    if (stageKey === 'survey' && booking.statusGroup === 'pending_payment') return '等待用户支付量房费';
    if (stageKey === 'budget') return '等待用户确认沟通结果';
    if (stageKey === 'quote' && normalizeStage(booking.currentStage) === 'design_fee_paying') return '等待用户支付设计费';
    if (stageKey === 'confirm') return '等待用户确认正式方案';
    if (stageKey === 'construction_prep') return '整理施工报价准备';
    if (stageKey === 'construction_quote') return '查看工长报价进度';
    return '进入流程继续推进';
};

const buildSupplementary = (proposal?: Proposal) => {
    if (!proposal) return '';
    const parts: string[] = [];
    if (typeof proposal.designFee === 'number') {
        parts.push(`设计费 ¥${proposal.designFee.toLocaleString()}`);
    }
    if (typeof proposal.estimatedDays === 'number' && proposal.estimatedDays > 0) {
        parts.push(`工期 ${proposal.estimatedDays} 天`);
    }
    return parts.join(' · ');
};

const buildProposalWorkspaceRows = (
    bookings: MerchantBookingEntry[],
    proposals: Proposal[],
): ProposalWorkspaceRow[] => {
    const latestProposalByBooking = new Map<number, Proposal>();

    [...proposals]
        .sort((left, right) => {
            const leftTime = new Date(left.createdAt || 0).getTime();
            const rightTime = new Date(right.createdAt || 0).getTime();
            return rightTime - leftTime || right.id - left.id;
        })
        .forEach((proposal) => {
            if (proposal.bookingId > 0 && !latestProposalByBooking.has(proposal.bookingId)) {
                latestProposalByBooking.set(proposal.bookingId, proposal);
            }
        });

    return bookings
        .filter(isProposalWorkspaceBooking)
        .map((booking) => {
            const linkedProposal = latestProposalByBooking.get(booking.id);
            const stageKey = buildWorkspaceStageKey(booking, linkedProposal);
            const statusMeta = buildStatusMeta(booking, linkedProposal, stageKey);

            return {
                key: `booking-${booking.id}`,
                bookingId: booking.id,
                title: booking.address || `预约 #${booking.id}`,
                meta: [
                    booking.userNickname || `用户${booking.userId}`,
                    booking.area ? `${booking.area}㎡` : '',
                    booking.houseLayout || '',
                ].filter(Boolean).join(' · '),
                supplementary: buildSupplementary(linkedProposal),
                stageKey,
                stageLabel: STAGE_LABELS[stageKey],
                statusLabel: statusMeta.label,
                statusColor: statusMeta.color,
                nextActionText: buildNextActionText(booking, linkedProposal, stageKey),
                updatedAt: linkedProposal?.createdAt || booking.createdAt,
                flowPath: buildFlowPath(booking),
            };
        })
        .sort((left, right) => {
            const orderDiff = STAGE_ORDER[left.stageKey] - STAGE_ORDER[right.stageKey];
            if (orderDiff !== 0) {
                return orderDiff;
            }
            const leftTime = new Date(left.updatedAt || 0).getTime();
            const rightTime = new Date(right.updatedAt || 0).getTime();
            return rightTime - leftTime;
        });
};

const MerchantProposals: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState<MerchantBookingEntry[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [activeFilter, setActiveFilter] = useState<WorkspaceFilterKey>('all');
    const [keyword, setKeyword] = useState('');
    const navigate = useNavigate();

    const loadWorkspace = async () => {
        try {
            setLoading(true);
            const [proposalRes, bookingRes] = await Promise.all([
                merchantProposalApi.list() as Promise<any>,
                merchantBookingApi.list(),
            ]);
            setProposals(proposalRes?.code === 0 ? (proposalRes.data?.list || []) : []);
            setBookings(bookingRes.list || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '加载方案报价失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadWorkspace();
    }, []);

    const workspaceRows = useMemo(
        () => buildProposalWorkspaceRows(bookings, proposals),
        [bookings, proposals],
    );

    const filteredRows = useMemo(() => {
        const searchValue = keyword.trim().toLowerCase();
        return workspaceRows.filter((row) => {
            if (activeFilter !== 'all' && row.stageKey !== activeFilter) {
                return false;
            }
            if (!searchValue) {
                return true;
            }
            return [
                row.title,
                row.meta,
                row.supplementary,
                row.stageLabel,
                row.statusLabel,
                row.nextActionText,
            ]
                .join(' ')
                .toLowerCase()
                .includes(searchValue);
        });
    }, [activeFilter, keyword, workspaceRows]);

    const columns: ColumnsType<ProposalWorkspaceRow> = [
        {
            title: '预约信息',
            dataIndex: 'title',
            render: (_value, record) => (
                <div className={styles.infoCell}>
                    <span className={styles.infoTitle}>{record.title}</span>
                    {record.meta ? <span className={styles.infoMeta}>{record.meta}</span> : null}
                    {record.supplementary ? <span className={styles.infoSupplementary}>{record.supplementary}</span> : null}
                </div>
            ),
        },
        {
            title: '当前阶段',
            dataIndex: 'stageLabel',
            width: 180,
            render: (value: string) => <span className={styles.stageText}>{value}</span>,
        },
        {
            title: '当前状态',
            dataIndex: 'statusLabel',
            width: 170,
            render: (_value, record) => <Tag color={record.statusColor}>{record.statusLabel}</Tag>,
        },
        {
            title: '下一步',
            dataIndex: 'nextActionText',
            width: 220,
            render: (value: string) => <span className={styles.nextAction}>{value}</span>,
        },
        {
            title: '更新时间',
            dataIndex: 'updatedAt',
            width: 180,
            render: (value?: string) => value ? formatServerDateTime(value) : '-',
        },
        {
            title: '操作',
            width: 150,
            render: (_value, record) => (
                <Button type="primary" onClick={() => navigate(record.flowPath)}>
                    进入流程
                </Button>
            ),
        },
    ];

    return (
        <MerchantPageShell className={styles.page}>
            <MerchantPageHeader
                title="方案报价"
                extra={(
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                            返回工作台
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={() => void loadWorkspace()} loading={loading}>
                            刷新
                        </Button>
                    </Space>
                )}
            />

            <MerchantContentPanel className={styles.contentPanel}>
                <MerchantSectionCard className={styles.filterCard}>
                    <div className={styles.filterBar}>
                        <div className={styles.filterGroup}>
                            {FILTERS.map((filter) => (
                                <Button
                                    key={filter.key}
                                    type={activeFilter === filter.key ? 'primary' : 'default'}
                                    className={styles.filterButton}
                                    onClick={() => setActiveFilter(filter.key)}
                                >
                                    {filter.label}
                                </Button>
                            ))}
                        </div>
                        <div className={styles.filterActions}>
                            <Search
                                allowClear
                                placeholder="搜索地址、用户或阶段"
                                className={styles.search}
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                            />
                            <Text className={styles.countText}>共 {filteredRows.length} 条</Text>
                        </div>
                    </div>
                </MerchantSectionCard>

                <MerchantSectionCard className={styles.tableSection}>
                    <Table
                        loading={loading}
                        columns={columns}
                        dataSource={filteredRows}
                        rowKey="key"
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        className={styles.table}
                        locale={{
                            emptyText: (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description="当前没有可推进的方案报价流程"
                                />
                            ),
                        }}
                    />
                </MerchantSectionCard>
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantProposals;
