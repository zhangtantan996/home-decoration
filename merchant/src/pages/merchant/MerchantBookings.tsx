import React, { useEffect, useMemo, useState } from 'react';
import type { UploadFile } from 'antd';
import {
    Alert,
    Button,
    Descriptions,
    Form,
    Input,
    InputNumber,
    Modal,
    Space,
    Table,
    Tabs,
    Tag,
    Typography,
    Upload,
    message,
} from 'antd';
import { ArrowLeftOutlined, EyeOutlined, FileAddOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantStatGrid from '../../components/MerchantStatGrid';
import sharedStyles from '../../components/MerchantPage.module.css';
import { BOOKING_STATUS_META } from '../../constants/statuses';
import {
    merchantBookingApi,
    merchantLeadApi,
    merchantProposalApi,
    merchantUploadApi,
    type MerchantBookingDetailResponse,
    type MerchantBookingEntry,
    type MerchantLeadItem,
    type MerchantUploadResult,
} from '../../services/merchantApi';
import { useDictStore } from '../../stores/dictStore';
import { getStoredPathsFromUploadFiles } from '../../utils/uploadAsset';

const { Paragraph } = Typography;
const { TextArea } = Input;

type IntakeStageKey = 'pending_lead' | 'transferred' | 'closed';

type IntakeRow = {
    key: string;
    source: 'lead' | 'booking';
    intakeStage: IntakeStageKey;
    title: string;
    location: string;
    owner: string;
    schedule: string;
    stageText: string;
    nextActionText: string;
    statusText: string;
    statusColor: string;
    lead?: MerchantLeadItem;
    booking?: MerchantBookingEntry;
};

const INTAKE_STAGE_META: Record<IntakeStageKey, { label: string; tone: 'amber' | 'blue' | 'slate' }> = {
    pending_lead: { label: '待响应线索', tone: 'amber' },
    transferred: { label: '已转后续流程', tone: 'blue' },
    closed: { label: '已关闭', tone: 'slate' },
};

const PROJECT_DOMAIN_STAGES = new Set([
    'ready_to_start',
    'in_construction',
    'node_acceptance_in_progress',
    'completed',
    'archived',
    'disputed',
    'payment_paused',
]);

const leadStatusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待响应', color: 'gold' },
    accepted: { text: '已接受', color: 'blue' },
    declined: { text: '已拒绝', color: 'default' },
    quoted: { text: '已提交方案', color: 'green' },
};

const resolveBookingStatus = (booking?: MerchantBookingEntry | null) => {
    if (!booking) {
        return { text: '处理中', color: 'default' };
    }
    if (booking.statusText) {
        return { text: booking.statusText, color: BOOKING_STATUS_META[booking.status]?.color || 'default' };
    }
    return BOOKING_STATUS_META[booking.status] || { text: '处理中', color: 'default' };
};

const resolvePrimaryRouteAction = (
    booking?: MerchantBookingEntry | null,
    hasProposal?: boolean,
): { label: string; path: string } | null => {
    if (!booking) {
        return null;
    }
    if (booking.currentStage && PROJECT_DOMAIN_STAGES.has(booking.currentStage)) {
        return { label: '查看项目', path: '/projects' };
    }
    const availableActions = booking.availableActions || [];

    if (availableActions.includes('submit_site_survey')) {
        return { label: '进入方案报价', path: `/proposals/flow/${booking.id}` };
    }
    if (availableActions.includes('submit_budget')) {
        return { label: '进入方案报价', path: `/proposals/flow/${booking.id}` };
    }
    if (availableActions.includes('create_design_fee_quote') || availableActions.includes('create_proposal') || hasProposal) {
        return { label: '进入方案报价', path: `/proposals/flow/${booking.id}` };
    }
    if ((booking.statusGroup && booking.statusGroup !== 'pending_confirmation' && booking.statusGroup !== 'cancelled') || booking.status === 2 || booking.status === 3) {
        return { label: '进入方案报价', path: `/proposals/flow/${booking.id}` };
    }
    return null;
};

const formatSurveyDepositText = (booking?: MerchantBookingEntry | null) => {
    if (!booking) {
        return '-';
    }
    const amount = Number(booking.surveyDepositAmount || 0);
    if (amount <= 0) {
        return '未设置';
    }
    return `¥${amount.toLocaleString()}`;
};

const formatLeadBudget = (lead: MerchantLeadItem) =>
    `¥${Math.round(lead.demand.budgetMin)} - ¥${Math.round(lead.demand.budgetMax)}`;

const classifyLeadStage = (lead: MerchantLeadItem): IntakeStageKey => {
    switch (lead.status) {
        case 'pending':
            return 'pending_lead';
        case 'declined':
            return 'closed';
        case 'accepted':
        case 'quoted':
            return 'transferred';
        default:
            return 'transferred';
    }
};

const classifyBookingStage = (booking: MerchantBookingEntry): IntakeStageKey => {
    if (booking.statusGroup === 'cancelled' || booking.status === 4 || booking.currentStage === 'cancelled') {
        return 'closed';
    }
    if (booking.statusGroup === 'pending_confirmation' || (!booking.statusGroup && booking.status === 1)) {
        return 'pending_lead';
    }
    return 'transferred';
};

const MerchantBookings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [bookings, setBookings] = useState<MerchantBookingEntry[]>([]);
    const [leads, setLeads] = useState<MerchantLeadItem[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [leadDetailVisible, setLeadDetailVisible] = useState(false);
    const [proposalVisible, setProposalVisible] = useState(false);
    const [declineVisible, setDeclineVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeStage, setActiveStage] = useState<IntakeStageKey>('pending_lead');
    const [currentDetail, setCurrentDetail] = useState<MerchantBookingDetailResponse | null>(null);
    const [detailLead, setDetailLead] = useState<MerchantLeadItem | null>(null);
    const [proposalLead, setProposalLead] = useState<MerchantLeadItem | null>(null);
    const [declineLead, setDeclineLead] = useState<MerchantLeadItem | null>(null);
    const [fileList, setFileList] = useState<Array<UploadFile<MerchantUploadResult>>>([]);
    const navigate = useNavigate();

    const { loadDict, getDictOptions } = useDictStore();
    const [proposalForm] = Form.useForm();
    const [declineForm] = Form.useForm();

    useEffect(() => {
        void loadAll();
        loadDict('renovation_type');
        loadDict('budget_range');
    }, [loadDict]);

    const getRenovationTypeLabel = (value?: string) => {
        if (!value) return '-';
        const options = getDictOptions('renovation_type');
        const option = options.find((item) => item.value === value);
        return option?.label || value;
    };

    const getBudgetRangeLabel = (value?: string) => {
        if (!value) return '-';
        const options = getDictOptions('budget_range');
        const option = options.find((item) => item.value === value);
        return option?.label || value;
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [bookingRes, leadRes] = await Promise.all([
                merchantBookingApi.list(),
                merchantLeadApi.list({ page: 1, pageSize: 50 }),
            ]);
            setBookings(bookingRes.list || []);
            setLeads(leadRes.list || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '加载线索预约失败');
        } finally {
            setLoading(false);
        }
    };

    const loadDetail = async (bookingId: number) => {
        try {
            setDetailLoading(true);
            const res = await merchantBookingApi.detail(bookingId);
            setCurrentDetail(res);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '加载详情失败');
        } finally {
            setDetailLoading(false);
        }
    };

    const showBookingDetail = async (record: MerchantBookingEntry) => {
        setDetailVisible(true);
        setCurrentDetail({ booking: record, hasProposal: record.hasProposal });
        await loadDetail(record.id);
    };

    const handleBooking = async (id: number, action: 'confirm' | 'reject') => {
        try {
            const res = await merchantBookingApi.handle(id, action);
            message.success(res.message || (action === 'confirm' ? '已接单' : '已拒绝'));
            await loadAll();
            if (detailVisible && currentDetail?.booking?.id === id) {
                await loadDetail(id);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '操作失败');
        }
    };

    const acceptLead = async (lead: MerchantLeadItem) => {
        try {
            await merchantLeadApi.accept(lead.id);
            message.success('已接受线索');
            await loadAll();
        } catch (error) {
            message.error(error instanceof Error ? error.message : '接受线索失败');
        }
    };

    const submitDecline = async () => {
        if (!declineLead) {
            return;
        }
        try {
            const values = await declineForm.validateFields();
            setSubmitting(true);
            await merchantLeadApi.decline(declineLead.id, values.reason);
            message.success('已拒绝线索');
            setDeclineVisible(false);
            setDeclineLead(null);
            declineForm.resetFields();
            await loadAll();
        } catch (error) {
            message.error(error instanceof Error ? error.message : '拒绝线索失败');
        } finally {
            setSubmitting(false);
        }
    };

    const openProposalModal = (lead: MerchantLeadItem) => {
        setProposalLead(lead);
        setProposalVisible(true);
        setFileList([]);
        proposalForm.resetFields();
        proposalForm.setFieldsValue({
            summary: `${lead.demand.title} · 初步方案`,
            designFee: 0,
            constructionFee: lead.demand.budgetMin || 0,
            materialFee: 0,
            estimatedDays: 60,
        });
    };

    const submitProposal = async () => {
        if (!proposalLead) {
            return;
        }
        try {
            const values = await proposalForm.validateFields();
            setSubmitting(true);
            const attachments = getStoredPathsFromUploadFiles(fileList);

            await merchantProposalApi.submit({
                sourceType: 'demand',
                demandMatchId: proposalLead.id,
                summary: values.summary,
                designFee: values.designFee,
                constructionFee: values.constructionFee,
                materialFee: values.materialFee,
                estimatedDays: values.estimatedDays,
                attachments: JSON.stringify(attachments),
            });
            message.success('方案已提交');
            setProposalVisible(false);
            setProposalLead(null);
            await loadAll();
            setActiveStage('transferred');
        } catch (error) {
            message.error(error instanceof Error ? error.message : '提交方案失败');
        } finally {
            setSubmitting(false);
        }
    };

    const rows = useMemo<IntakeRow[]>(() => {
        const leadRows = leads.map((lead) => {
            const statusMeta = leadStatusMap[lead.status] || { text: lead.status, color: 'default' };
            const stage = classifyLeadStage(lead);
            return {
                key: `lead-${lead.id}`,
                source: 'lead' as const,
                intakeStage: stage,
                title: lead.demand.title || `线索 #${lead.id}`,
                location: `${lead.demand.city || '-'}${lead.demand.district ? ` / ${lead.demand.district}` : ''}`,
                owner: '平台线索',
                schedule: lead.responseDeadline || lead.assignedAt || '-',
                stageText: INTAKE_STAGE_META[stage].label,
                nextActionText:
                    lead.status === 'pending'
                        ? '判断是否承接'
                        : lead.status === 'accepted'
                            ? '提交方案进入后续流程'
                            : lead.status === 'quoted'
                                ? '已进入方案报价，查看后续进展'
                                : '查看历史处理结果',
                statusText: statusMeta.text,
                statusColor: statusMeta.color,
                lead,
            };
        });

        const bookingRows = bookings.map((booking) => {
            const statusMeta = resolveBookingStatus(booking);
            const stage = classifyBookingStage(booking);
            const routeAction = resolvePrimaryRouteAction(booking, booking.hasProposal);
            return {
                key: `booking-${booking.id}`,
                source: 'booking' as const,
                intakeStage: stage,
                title: booking.address || `预约 #${booking.id}`,
                location: `${booking.area || 0}㎡ · ${booking.houseLayout || '户型待补充'}`,
                owner: booking.userNickname || `用户${booking.userId}`,
                schedule: booking.preferredDate || booking.createdAt || '-',
                stageText: booking.currentStageText || INTAKE_STAGE_META[stage].label,
                nextActionText:
                    booking.statusGroup === 'pending_confirmation'
                        ? '确认是否接单'
                        : routeAction?.label === '查看项目'
                            ? '前往项目履约继续跟进'
                            : booking.statusGroup === 'pending_payment'
                                ? '等待量房费支付后继续推进'
                                : '进入方案报价继续推进',
                statusText: statusMeta.text,
                statusColor: statusMeta.color,
                booking,
            };
        });

        return [...leadRows, ...bookingRows];
    }, [bookings, leads]);

    const stageCounts = useMemo(() => {
        return rows.reduce<Record<IntakeStageKey, number>>((acc, item) => {
            acc[item.intakeStage] += 1;
            return acc;
        }, {
            pending_lead: 0,
            transferred: 0,
            closed: 0,
        });
    }, [rows]);

    const totalCount = rows.length || 1;
    const statItems = useMemo(() => ([
        {
            label: '待响应线索',
            value: stageCounts.pending_lead,
            meta: '待判断是否承接',
            percent: (stageCounts.pending_lead / totalCount) * 100,
            tone: INTAKE_STAGE_META.pending_lead.tone,
        },
        {
            label: '已转后续流程',
            value: stageCounts.transferred,
            meta: '预约已确认，转入后续推进',
            percent: (stageCounts.transferred / totalCount) * 100,
            tone: INTAKE_STAGE_META.transferred.tone,
        },
        {
            label: '已关闭',
            value: stageCounts.closed,
            meta: '取消、拒绝、终止等历史记录',
            percent: (stageCounts.closed / totalCount) * 100,
            tone: INTAKE_STAGE_META.closed.tone,
        },
    ]), [stageCounts, totalCount]);

    const filteredRows = useMemo(
        () => rows.filter((item) => item.intakeStage === activeStage),
        [activeStage, rows],
    );

    const currentBooking = currentDetail?.booking || null;
    const currentStatus = resolveBookingStatus(currentBooking);
    const currentRouteAction = resolvePrimaryRouteAction(currentBooking, currentDetail?.hasProposal);

    const columns = [
        {
            title: '来源',
            dataIndex: 'source',
            width: 108,
            render: (value: IntakeRow['source']) => (
                <Tag color={value === 'lead' ? 'gold' : 'blue'}>{value === 'lead' ? '线索' : '预约'}</Tag>
            ),
        },
        {
            title: '标题 / 地址',
            dataIndex: 'title',
            render: (_: string, record: IntakeRow) => (
                <Space direction="vertical" size={2}>
                    <span>{record.title}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{record.location}</span>
                </Space>
            ),
        },
        {
            title: '对象',
            dataIndex: 'owner',
            width: 160,
        },
        {
            title: '时限 / 时间',
            dataIndex: 'schedule',
            width: 180,
            render: (value: string) => value || '-',
        },
        {
            title: '当前阶段',
            dataIndex: 'stageText',
            width: 160,
            render: (value: string, record: IntakeRow) => (
                <Space direction="vertical" size={2}>
                    <span>{value}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{record.nextActionText}</span>
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'statusText',
            width: 140,
            render: (_: string, record: IntakeRow) => (
                <Tag color={record.statusColor}>{record.statusText}</Tag>
            ),
        },
        {
            title: '操作',
            width: 280,
            render: (_: unknown, record: IntakeRow) => {
                if (record.source === 'lead' && record.lead) {
                    const lead = record.lead;
                    return (
                        <Space wrap>
                            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => {
                                setDetailLead(lead);
                                setLeadDetailVisible(true);
                            }}>
                                详情
                            </Button>
                            {lead.status === 'pending' ? (
                                <>
                                    <Button type="primary" size="small" onClick={() => void acceptLead(lead)}>
                                        接受
                                    </Button>
                                    <Button
                                        size="small"
                                        danger
                                        onClick={() => {
                                            setDeclineLead(lead);
                                            setDeclineVisible(true);
                                            declineForm.resetFields();
                                        }}
                                    >
                                        拒绝
                                    </Button>
                                </>
                            ) : null}
                            {lead.status === 'accepted' ? (
                                <Button type="primary" ghost size="small" icon={<FileAddOutlined />} onClick={() => openProposalModal(lead)}>
                                    提交方案
                                </Button>
                            ) : null}
                            {lead.status === 'quoted' ? (
                                <Button type="primary" size="small" onClick={() => navigate('/proposals')}>
                                    进入方案报价
                                </Button>
                            ) : null}
                        </Space>
                    );
                }

                if (record.booking) {
                    const booking = record.booking;
                    const routeAction = resolvePrimaryRouteAction(booking, booking.hasProposal);
                    return (
                        <Space wrap>
                            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void showBookingDetail(booking)}>
                                详情
                            </Button>
                            {booking.statusGroup === 'pending_confirmation' ? (
                                <>
                                    <Button type="primary" size="small" onClick={() => void handleBooking(booking.id, 'confirm')}>
                                        接单
                                    </Button>
                                    <Button
                                        danger
                                        size="small"
                                        onClick={() => {
                                            Modal.confirm({
                                                title: '确认拒单',
                                                content: '确定要拒绝这条预约吗？操作后不可撤销。',
                                                onOk: () => handleBooking(booking.id, 'reject'),
                                            });
                                        }}
                                    >
                                        拒单
                                    </Button>
                                </>
                            ) : null}
                            {booking.statusGroup !== 'pending_confirmation' && routeAction ? (
                                <Button
                                    type="primary"
                                    ghost
                                    size="small"
                                    icon={<FileAddOutlined />}
                                    onClick={() => navigate(routeAction.path)}
                                >
                                    {routeAction.label}
                                </Button>
                            ) : null}
                        </Space>
                    );
                }

                return null;
            },
        },
    ];

    return (
        <>
            <MerchantPageShell>
                <MerchantPageHeader
                    title="线索预约"
                    description="这里只处理待响应线索与预约确认；已确认的单据会转入后续流程继续推进。"
                    extra={(
                        <Space>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                                返回工作台
                            </Button>
                            <Button icon={<ReloadOutlined />} onClick={() => void loadAll()}>
                                刷新
                            </Button>
                        </Space>
                    )}
                />

                <MerchantStatGrid items={statItems} />

                <MerchantContentPanel>
                    <MerchantSectionCard>
                        <Tabs
                            activeKey={activeStage}
                            onChange={(key) => setActiveStage(key as IntakeStageKey)}
                            items={(Object.keys(INTAKE_STAGE_META) as IntakeStageKey[]).map((key) => ({
                                key,
                                label: `${INTAKE_STAGE_META[key].label} (${stageCounts[key]})`,
                            }))}
                        />

                        <Table
                            loading={loading}
                            dataSource={filteredRows}
                            columns={columns}
                            rowKey="key"
                            pagination={{ pageSize: 10 }}
                            className={sharedStyles.tableCard}
                        />
                    </MerchantSectionCard>
                </MerchantContentPanel>
            </MerchantPageShell>

            <Modal
                title="预约详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={
                    <Space>
                        {currentBooking?.statusGroup === 'pending_confirmation' && (
                            <>
                                <Button
                                    onClick={() => {
                                        Modal.confirm({
                                            title: '确认拒单',
                                            content: '确定要拒绝这条预约吗？操作后不可撤销。',
                                            onOk: () => handleBooking(currentBooking.id, 'reject'),
                                        });
                                    }}
                                >
                                    拒单
                                </Button>
                                <Button type="primary" onClick={() => void handleBooking(currentBooking.id, 'confirm')}>
                                    接单
                                </Button>
                            </>
                        )}
                        {currentBooking?.statusGroup !== 'pending_confirmation' && currentRouteAction ? (
                            <Button
                                type="primary"
                                onClick={() => {
                                    setDetailVisible(false);
                                    navigate(currentRouteAction.path);
                                }}
                            >
                                {currentRouteAction.label}
                            </Button>
                        ) : null}
                        <Button onClick={() => setDetailVisible(false)}>关闭</Button>
                    </Space>
                }
                width={760}
            >
                {detailLoading ? (
                    <Paragraph type="secondary">加载中...</Paragraph>
                ) : currentBooking ? (
                    <>
                        {currentBooking.flowSummary ? (
                            <Alert
                                style={{ marginBottom: 16 }}
                                type="info"
                                showIcon
                                message="流程说明"
                                description={currentBooking.flowSummary}
                            />
                        ) : null}
                        <Descriptions column={2} bordered size="small">
                            <Descriptions.Item label="预约 ID">{currentBooking.id}</Descriptions.Item>
                            <Descriptions.Item label="用户">
                                {currentBooking.userNickname || `用户${currentBooking.userId}`}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={currentStatus.color}>{currentStatus.text}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="当前阶段">
                                {currentBooking.currentStageText || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="项目地址" span={2}>
                                {currentBooking.address || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="面积">{currentBooking.area || 0}㎡</Descriptions.Item>
                            <Descriptions.Item label="户型">{currentBooking.houseLayout || '-'}</Descriptions.Item>
                            <Descriptions.Item label="装修类型">
                                {getRenovationTypeLabel(currentBooking.renovationType)}
                            </Descriptions.Item>
                            <Descriptions.Item label="预算范围">
                                {getBudgetRangeLabel(currentBooking.budgetRange)}
                            </Descriptions.Item>
                            <Descriptions.Item label="预约时间">
                                {currentBooking.preferredDate || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="联系电话">
                                {currentBooking.phone || currentBooking.userPhone || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="量房费">
                                {formatSurveyDepositText(currentBooking)}
                            </Descriptions.Item>
                            <Descriptions.Item label="支付状态">
                                {currentBooking.surveyDepositPaid ? '已支付' : '未支付'}
                            </Descriptions.Item>
                            <Descriptions.Item label="支付时间">
                                {currentBooking.surveyDepositPaidAt || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="备注" span={2}>
                                {currentBooking.notes || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="创建时间" span={2}>
                                {currentBooking.createdAt || '-'}
                            </Descriptions.Item>
                        </Descriptions>
                    </>
                ) : (
                    <Paragraph type="secondary">暂无预约详情</Paragraph>
                )}
            </Modal>

            <Modal
                open={leadDetailVisible}
                title="线索详情"
                footer={null}
                onCancel={() => setLeadDetailVisible(false)}
                width={760}
            >
                {detailLead ? (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="需求标题" span={2}>{detailLead.demand.title}</Descriptions.Item>
                            <Descriptions.Item label="需求类型">{detailLead.demand.demandType}</Descriptions.Item>
                            <Descriptions.Item label="状态">{leadStatusMap[detailLead.status]?.text || detailLead.status}</Descriptions.Item>
                            <Descriptions.Item label="区域">{detailLead.demand.city} / {detailLead.demand.district}</Descriptions.Item>
                            <Descriptions.Item label="面积">{detailLead.demand.area}㎡</Descriptions.Item>
                            <Descriptions.Item label="预算" span={2}>{formatLeadBudget(detailLead)}</Descriptions.Item>
                            <Descriptions.Item label="响应截止" span={2}>{detailLead.responseDeadline || '-'}</Descriptions.Item>
                            <Descriptions.Item label="审核备注" span={2}>{detailLead.demand.reviewNote || '暂无'}</Descriptions.Item>
                        </Descriptions>
                        <Typography.Text strong>需求附件</Typography.Text>
                        {detailLead.attachments.length === 0 ? (
                            <Typography.Text type="secondary">暂无附件</Typography.Text>
                        ) : (
                            <Space direction="vertical">
                                {detailLead.attachments.map((item) => (
                                    <Typography.Link href={item.url} key={item.url} target="_blank" rel="noreferrer">
                                        {item.name} ({Math.max(1, Math.round(item.size / 1024))} KB)
                                    </Typography.Link>
                                ))}
                            </Space>
                        )}
                    </Space>
                ) : null}
            </Modal>

            <Modal
                open={proposalVisible}
                title={proposalLead ? `提交方案 · ${proposalLead.demand.title}` : '提交方案'}
                onCancel={() => setProposalVisible(false)}
                onOk={() => void submitProposal()}
                confirmLoading={submitting}
                width={760}
            >
                <Form form={proposalForm} layout="vertical">
                    <Form.Item label="方案摘要" name="summary" rules={[{ required: true, message: '请输入方案摘要' }]}>
                        <TextArea rows={4} placeholder="概述你的方案思路、边界和主要判断。" />
                    </Form.Item>
                    <Space size="middle" style={{ width: '100%' }} align="start">
                        <Form.Item label="设计费" name="designFee" rules={[{ required: true, message: '请输入设计费' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="施工费" name="constructionFee" rules={[{ required: true, message: '请输入施工费' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item label="主材费" name="materialFee" rules={[{ required: true, message: '请输入主材费' }]} style={{ flex: 1 }}>
                            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                        </Form.Item>
                    </Space>
                    <Form.Item label="预计工期（天）" name="estimatedDays" rules={[{ required: true, message: '请输入预计工期' }]}>
                        <InputNumber min={1} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="方案附件">
                        <Upload
                            fileList={fileList}
                            customRequest={async (options) => {
                                try {
                                    const uploaded = await merchantUploadApi.uploadImageData(options.file as File);
                                    options.onSuccess?.(uploaded);
                                } catch (error) {
                                    options.onError?.(error as Error);
                                }
                            }}
                            onChange={({ fileList: next }) => setFileList(next)}
                        >
                            <Button icon={<UploadOutlined />}>上传附件</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={declineVisible}
                title="拒绝线索"
                onCancel={() => setDeclineVisible(false)}
                onOk={() => void submitDecline()}
                confirmLoading={submitting}
            >
                <Form form={declineForm} layout="vertical">
                    <Form.Item label="拒绝原因" name="reason" rules={[{ required: true, message: '请填写拒绝原因' }]}>
                        <TextArea rows={4} placeholder="例如：当前排期已满，无法在要求时间内响应。" />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default MerchantBookings;
