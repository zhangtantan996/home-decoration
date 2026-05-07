import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Space, Spin, Tag, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import AdminReauthModal from '../../components/AdminReauthModal';
import { adminRefundApi, type AdminRefundApplicationItem } from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { REFUND_STATUS_META, REFUND_TYPE_LABELS, isSecurityAuditorRole } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

const normalizeDetail = (raw: any): AdminRefundApplicationItem | null => {
    const data = raw?.data;
    if (!data) return null;
    if (data.refundApplication) return data.refundApplication as AdminRefundApplicationItem;
    return data as AdminRefundApplicationItem;
};

const parseEvidence = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item));
    }
    if (typeof value === 'string' && value.trim() !== '') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item));
            }
        } catch {
            return value.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
};

const isSafeEvidenceURL = (url: string): boolean => {
    const lower = url.trim().toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
        return false;
    }
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
        return true;
    }
    return false;
};

const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const RefundDetail: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const admin = useAuthStore((state) => state.admin);
    const refundId = Number(params.id || 0);
    const [approveForm] = Form.useForm();
    const [rejectForm] = Form.useForm();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [approveVisible, setApproveVisible] = useState(false);
    const [rejectVisible, setRejectVisible] = useState(false);
    const [reauthOpen, setReauthOpen] = useState(false);
    const [reauthAction, setReauthAction] = useState<'approve' | 'reject' | null>(null);
    const [pendingValues, setPendingValues] = useState<Record<string, unknown> | null>(null);
    const [item, setItem] = useState<AdminRefundApplicationItem | null>(null);
    const { hasPermission } = usePermission();
    const isSecurityAuditor = isSecurityAuditorRole(admin?.roles);

    const loadData = async () => {
        if (!Number.isFinite(refundId) || refundId <= 0) {
            message.error('无效退款申请ID');
            return;
        }
        try {
            setLoading(true);
            const res = await adminRefundApi.detail(refundId);
            if (res?.code !== 0) {
                message.error(res?.message || '加载退款详情失败');
                setItem(null);
                return;
            }
            setItem(normalizeDetail(res));
        } catch {
            message.error('加载退款详情失败');
            setItem(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [refundId]);

    const statusTag = useMemo(() => {
        if (!item) return null;
        const config = REFUND_STATUS_META[item.status] || { text: item.status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
    }, [item]);

    const canAudit = item?.status === 'pending' && !isSecurityAuditor && hasPermission('finance:transaction:approve');
    const evidence = parseEvidence(item?.evidence);

    const handleExport = () => {
        if (!item) {
            return;
        }
        downloadJson(`refund-application-${item.id}.json`, {
            generatedAt: new Date().toISOString(),
            refundApplication: item,
            evidence,
        });
        message.success('退款详情快照已导出');
    };

    const handleApprove = async () => {
        if (!item) return;
        try {
            const values = await approveForm.validateFields();
            setPendingValues(values);
            setReauthAction('approve');
            setReauthOpen(true);
        } catch {
            // 表单校验失败
        }
    };

    const handleReject = async () => {
        if (!item) return;
        try {
            const values = await rejectForm.validateFields();
            setPendingValues(values);
            setReauthAction('reject');
            setReauthOpen(true);
        } catch {
            // 表单校验失败
        }
    };

    const handleReauthConfirmed = async (payload: { reason?: string; recentReauthProof: string }) => {
        if (!item || !pendingValues || !reauthAction) return;
        try {
            setSubmitting(true);
            if (reauthAction === 'approve') {
                const res = await adminRefundApi.approve(item.id, {
                    approvedAmount: pendingValues.approvedAmount as number | undefined,
                    adminNotes: String(pendingValues.adminNotes || payload.reason || ''),
                    recentReauthProof: payload.recentReauthProof,
                });
                if (res?.code !== 0) {
                    throw new Error(res?.message || '批准失败');
                }
                message.success('退款申请已批准');
                setApproveVisible(false);
                approveForm.resetFields();
            } else {
                const res = await adminRefundApi.reject(item.id, {
                    adminNotes: String(pendingValues.adminNotes || payload.reason || ''),
                    recentReauthProof: payload.recentReauthProof,
                });
                if (res?.code !== 0) {
                    throw new Error(res?.message || '拒绝失败');
                }
                message.success('退款申请已拒绝');
                setRejectVisible(false);
                rejectForm.resetFields();
            }
            setPendingValues(null);
            await loadData();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="hz-page-stack">
            <PageHeader
                title={`退款详情 #${refundId || '-'}`}
                description="查看退款申请信息并执行审核动作。"
                extra={(
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/refunds')}>
                            返回列表
                        </Button>
                        {item ? (
                            <Button icon={<DownloadOutlined />} onClick={handleExport}>
                                导出快照
                            </Button>
                        ) : null}
                        {canAudit ? (
                            <>
                                <Button type="primary" onClick={() => setApproveVisible(true)}>
                                    批准
                                </Button>
                                <Button danger onClick={() => setRejectVisible(true)}>
                                    拒绝
                                </Button>
                            </>
                        ) : null}
                    </Space>
                )}
            />

            <Card className="hz-table-card">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 48 }}>
                        <Spin />
                    </div>
                ) : !item ? (
                    <Empty description="未找到退款详情" />
                ) : (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        {isSecurityAuditor ? (
                            <Alert
                                type="info"
                                showIcon
                                message="当前账号为安全审计员视角"
                                description="本页仅保留退款详情查看与快照导出能力，审批写操作已隐藏。"
                            />
                        ) : null}
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="申请ID">{item.id}</Descriptions.Item>
                            <Descriptions.Item label="状态">{statusTag}</Descriptions.Item>
                            <Descriptions.Item label="预约ID">{item.bookingId}</Descriptions.Item>
                            <Descriptions.Item label="项目ID">{item.projectId || '-'}</Descriptions.Item>
                            <Descriptions.Item label="订单ID">{item.orderId || '-'}</Descriptions.Item>
                            <Descriptions.Item label="用户ID">{item.userId}</Descriptions.Item>
                            <Descriptions.Item label="退款类型">{REFUND_TYPE_LABELS[item.refundType] || item.refundType}</Descriptions.Item>
                            <Descriptions.Item label="申请金额">¥{Number(item.requestedAmount || 0).toLocaleString()}</Descriptions.Item>
                            <Descriptions.Item label="批准金额">{item.approvedAmount != null ? `¥${Number(item.approvedAmount).toLocaleString()}` : '-'}</Descriptions.Item>
                            <Descriptions.Item label="申请原因" span={2}>{item.reason || '-'}</Descriptions.Item>
                            <Descriptions.Item label="证据材料" span={2}>
                                {evidence.length === 0 ? '-' : (
                                    <Space direction="vertical">
                                        {evidence.map((url) => (
                                            isSafeEvidenceURL(url) ? (
                                                <a key={url} href={url} target="_blank" rel="noreferrer noopener">{url}</a>
                                            ) : (
                                                <span key={url}>{url}</span>
                                            )
                                        ))}
                                    </Space>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="审核意见" span={2}>{item.adminNotes || '-'}</Descriptions.Item>
                            <Descriptions.Item label="创建时间">{formatServerDateTime(item.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="批准时间">{formatServerDateTime(item.approvedAt)}</Descriptions.Item>
                            <Descriptions.Item label="拒绝时间">{formatServerDateTime(item.rejectedAt)}</Descriptions.Item>
                            <Descriptions.Item label="完成时间">{formatServerDateTime(item.completedAt)}</Descriptions.Item>
                        </Descriptions>
                    </Space>
                )}
            </Card>

            <Modal
                open={approveVisible}
                title="批准退款申请"
                confirmLoading={submitting}
                onOk={() => void handleApprove()}
                onCancel={() => setApproveVisible(false)}
            >
                <Form form={approveForm} layout="vertical">
                    <Form.Item label="批准金额" name="approvedAmount">
                        <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="不填则由后端按默认规则执行" />
                    </Form.Item>
                    <Form.Item label="审核意见" name="adminNotes">
                        <Input.TextArea rows={4} placeholder="填写审核意见（可选）" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={rejectVisible}
                title="拒绝退款申请"
                confirmLoading={submitting}
                onOk={() => void handleReject()}
                onCancel={() => setRejectVisible(false)}
            >
                <Form form={rejectForm} layout="vertical">
                    <Form.Item
                        label="拒绝原因"
                        name="adminNotes"
                        rules={[{ required: true, message: '请填写拒绝原因' }]}
                    >
                        <Input.TextArea rows={4} placeholder="请填写拒绝原因" />
                    </Form.Item>
                </Form>
            </Modal>

            <AdminReauthModal
                open={reauthOpen}
                title={reauthAction === 'approve' ? '批准退款申请' : '拒绝退款申请'}
                description={`即将处理退款申请 #${item?.id || '-'}`}
                reasonRequired={false}
                onCancel={() => {
                    setReauthOpen(false);
                    setPendingValues(null);
                    setReauthAction(null);
                }}
                onConfirmed={handleReauthConfirmed}
            />
        </div>
    );
};

export default RefundDetail;
