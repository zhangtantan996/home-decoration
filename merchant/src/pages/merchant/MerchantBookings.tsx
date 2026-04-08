import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Descriptions, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, FileAddOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import MerchantContentPanel from '../../components/MerchantContentPanel';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import sharedStyles from '../../components/MerchantPage.module.css';
import { BOOKING_STATUS_META } from '../../constants/statuses';
import {
    merchantBookingApi,
    type MerchantBookingDetailResponse,
    type MerchantBookingEntry,
} from '../../services/merchantApi';
import { useDictStore } from '../../stores/dictStore';

const { Text, Paragraph } = Typography;

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
    const availableActions = booking.availableActions || [];

    if (availableActions.includes('submit_site_survey')) {
        return { label: '提交量房记录', path: `/bookings/${booking.id}/site-survey` };
    }
    if (availableActions.includes('submit_budget')) {
        return { label: '提交预算确认', path: `/bookings/${booking.id}/budget-confirm` };
    }
    if (availableActions.includes('create_proposal') || hasProposal) {
        return { label: hasProposal ? '继续跟进' : '进入设计流程', path: `/bookings/${booking.id}/design-workflow` };
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

const MerchantBookings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [bookings, setBookings] = useState<MerchantBookingEntry[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentDetail, setCurrentDetail] = useState<MerchantBookingDetailResponse | null>(null);
    const navigate = useNavigate();

    const { loadDict, getDictOptions } = useDictStore();

    useEffect(() => {
        void loadBookings();
        loadDict('renovation_type');
        loadDict('budget_range');
    }, [loadDict]);

    const getRenovationTypeLabel = (value?: string) => {
        if (!value) return '-';
        const options = getDictOptions('renovation_type');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const getBudgetRangeLabel = (value?: string) => {
        if (!value) return '-';
        const options = getDictOptions('budget_range');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const loadBookings = async () => {
        try {
            setLoading(true);
            const res = await merchantBookingApi.list();
            setBookings(res.list || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : '加载失败');
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

    const showDetail = async (record: MerchantBookingEntry) => {
        setDetailVisible(true);
        setCurrentDetail({ booking: record, hasProposal: record.hasProposal });
        await loadDetail(record.id);
    };

    const handleBooking = async (id: number, action: 'confirm' | 'reject') => {
        try {
            const res = await merchantBookingApi.handle(id, action);
            message.success(res.message || (action === 'confirm' ? '已接单' : '已拒绝'));
            await loadBookings();
            if (detailVisible && currentDetail?.booking?.id === id) {
                await loadDetail(id);
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : '操作失败');
        }
    };

    const currentBooking = currentDetail?.booking || null;
    const currentStatus = resolveBookingStatus(currentBooking);
    const currentRouteAction = resolvePrimaryRouteAction(currentBooking, currentDetail?.hasProposal);

    const columns = useMemo(() => ([
        { title: 'ID', dataIndex: 'id', width: 72 },
        { title: '地址', dataIndex: 'address', ellipsis: true },
        { title: '面积', dataIndex: 'area', render: (value: number) => `${value || 0}㎡` },
        { title: '户型', dataIndex: 'houseLayout', render: (value?: string) => value || '-' },
        { title: '装修类型', dataIndex: 'renovationType', render: (value?: string) => getRenovationTypeLabel(value) },
        { title: '预算', dataIndex: 'budgetRange', render: (value?: string) => getBudgetRangeLabel(value) },
        { title: '预约时间', dataIndex: 'preferredDate', width: 160, render: (value?: string) => value || '-' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (_: number, record: MerchantBookingEntry) => {
                const meta = resolveBookingStatus(record);
                return <Tag color={meta.color}>{meta.text}</Tag>;
            },
        },
        {
            title: '操作',
            width: 320,
            render: (_: unknown, record: MerchantBookingEntry) => {
                const meta = resolvePrimaryRouteAction(record, record.hasProposal);

                return (
                    <Space wrap>
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => void showDetail(record)}
                        >
                            详情
                        </Button>
                        {record.statusGroup === 'pending_confirmation' && (
                            <>
                                <Button type="primary" size="small" onClick={() => void handleBooking(record.id, 'confirm')}>
                                    接单
                                </Button>
                                <Button
                                    danger
                                    size="small"
                                    onClick={() => {
                                        Modal.confirm({
                                            title: '确认拒单',
                                            content: '确定要拒绝这条预约吗？操作后不可撤销。',
                                            onOk: () => handleBooking(record.id, 'reject'),
                                        });
                                    }}
                                >
                                    拒单
                                </Button>
                            </>
                        )}
                        {record.statusGroup === 'pending_payment' ? (
                            <Text type="secondary">等待用户支付量房费</Text>
                        ) : null}
                        {record.statusGroup !== 'pending_confirmation' && record.statusGroup !== 'pending_payment' && meta ? (
                            <Button
                                type="primary"
                                ghost
                                size="small"
                                icon={<FileAddOutlined />}
                                onClick={() => navigate(meta.path)}
                            >
                                {meta.label}
                            </Button>
                        ) : null}
                    </Space>
                );
            },
        },
    ]), [getBudgetRangeLabel, getRenovationTypeLabel, navigate]);

    return (
        <>
            <MerchantPageShell>
                <MerchantPageHeader
                    title="预约管理"
                    description="先确认是否接单，确认后等待用户支付量房费，再继续推进量房记录、预算确认和后续方案链路。"
                    extra={(
                        <>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                                返回首页
                            </Button>
                            <Button icon={<ReloadOutlined />} onClick={() => void loadBookings()}>
                                刷新
                            </Button>
                        </>
                    )}
                />

                <MerchantContentPanel>
                    <MerchantSectionCard>
                        <Table
                            loading={loading}
                            dataSource={bookings}
                            columns={columns}
                            rowKey="id"
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
                        {currentBooking?.statusGroup === 'pending_payment' ? (
                            <Button disabled>等待用户支付量房费</Button>
                        ) : null}
                        {currentBooking?.statusGroup !== 'pending_confirmation' && currentBooking?.statusGroup !== 'pending_payment' && currentRouteAction ? (
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
        </>
    );
};

export default MerchantBookings;
