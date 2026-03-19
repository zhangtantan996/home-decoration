import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Descriptions, Empty, Space, Spin, Tag, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import { adminProjectAuditApi, type AdminProjectAuditItem } from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { PROJECT_AUDIT_CONCLUSION_LABELS, PROJECT_AUDIT_STATUS_META, PROJECT_AUDIT_TYPE_LABELS } from '../../constants/statuses';

const normalizeAuditDetail = (raw: any): AdminProjectAuditItem | null => {
    const data = raw?.data;
    if (!data) return null;
    if (data.audit) return data.audit as AdminProjectAuditItem;
    return data as AdminProjectAuditItem;
};

const pretty = (value: unknown) => {
    if (value == null) return '-';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const ProjectAuditDetail: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const auditId = Number(params.id || 0);

    const [loading, setLoading] = useState(false);
    const [item, setItem] = useState<AdminProjectAuditItem | null>(null);
    const { hasPermission } = usePermission();

    const loadData = async () => {
        if (!Number.isFinite(auditId) || auditId <= 0) {
            message.error('无效审计ID');
            return;
        }
        try {
            setLoading(true);
            const res = await adminProjectAuditApi.detail(auditId);
            if (res?.code !== 0) {
                message.error(res?.message || '加载审计详情失败');
                setItem(null);
                return;
            }
            setItem(normalizeAuditDetail(res));
        } catch {
            message.error('加载审计详情失败');
            setItem(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [auditId]);

    const statusTag = useMemo(() => {
        if (!item) return null;
        const config = PROJECT_AUDIT_STATUS_META[item.status] || { text: item.status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
    }, [item]);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title={`项目审计详情 #${auditId || '-'}`}
                description="查看争议、托管快照、退款关联与仲裁结论。"
                extra={(
                    <Space>
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/project-audits')}>
                            返回列表
                        </Button>
                        {item?.status !== 'completed' && hasPermission('risk:arbitration:judge') ? (
                            <Button type="primary" onClick={() => navigate(`/project-audits/${auditId}/arbitrate`)}>
                                去仲裁
                            </Button>
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
                    <Empty description="未找到审计详情" />
                ) : (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="审计ID">{item.id}</Descriptions.Item>
                        <Descriptions.Item label="项目ID">{item.projectId}</Descriptions.Item>
                        <Descriptions.Item label="审计类型">{PROJECT_AUDIT_TYPE_LABELS[item.auditType] || item.auditType}</Descriptions.Item>
                        <Descriptions.Item label="状态">{statusTag}</Descriptions.Item>
                        <Descriptions.Item label="投诉ID">{item.complaintId || '-'}</Descriptions.Item>
                        <Descriptions.Item label="退款申请ID">{item.refundApplicationId || '-'}</Descriptions.Item>
                        <Descriptions.Item label="审计记录" span={2}>{item.auditNotes || '-'}</Descriptions.Item>
                        <Descriptions.Item label="仲裁结论">{item.conclusion ? (PROJECT_AUDIT_CONCLUSION_LABELS[item.conclusion] || item.conclusion) : '-'}</Descriptions.Item>
                        <Descriptions.Item label="仲裁原因">{item.conclusionReason || '-'}</Descriptions.Item>
                        <Descriptions.Item label="执行方案" span={2}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(item.executionPlan)}</pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="创建时间">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</Descriptions.Item>
                        <Descriptions.Item label="完成时间">{item.completedAt ? new Date(item.completedAt).toLocaleString() : '-'}</Descriptions.Item>
                        <Descriptions.Item label="项目摘要" span={2}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(item.project)}</pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="争议摘要" span={2}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(item.complaint)}</pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="托管快照" span={2}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(item.escrow)}</pre>
                        </Descriptions.Item>
                        <Descriptions.Item label="退款关联" span={2}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(item.refundApplication)}</pre>
                        </Descriptions.Item>
                    </Descriptions>
                )}
            </Card>
        </div>
    );
};

export default ProjectAuditDetail;
