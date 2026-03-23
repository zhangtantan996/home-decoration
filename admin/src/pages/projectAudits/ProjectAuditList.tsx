import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Empty, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import { adminProjectAuditApi, type AdminProjectAuditItem } from '../../services/api';
import { usePermission } from '../../hooks/usePermission';
import { PROJECT_AUDIT_CONCLUSION_LABELS, PROJECT_AUDIT_STATUS_META, PROJECT_AUDIT_STATUS_OPTIONS, PROJECT_AUDIT_TYPE_LABELS } from '../../constants/statuses';
import { formatServerDateTime } from '../../utils/serverTime';

type ApiListPayload = {
    list?: AdminProjectAuditItem[];
    total?: number;
};

const extractListData = (raw: any): ApiListPayload => {
    const data = raw?.data;
    if (Array.isArray(data)) {
        return { list: data, total: data.length };
    }
    if (Array.isArray(data?.list)) {
        return { list: data.list, total: Number(data.total || 0) };
    }
    if (Array.isArray(raw?.list)) {
        return { list: raw.list, total: Number(raw.total || 0) };
    }
    return { list: [], total: 0 };
};

const ProjectAuditList: React.FC = () => {
    const navigate = useNavigate();
    const { hasPermission } = usePermission();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<AdminProjectAuditItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [status, setStatus] = useState<string | undefined>();

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await adminProjectAuditApi.list({ page, pageSize, status });
            if (res?.code !== 0) {
                message.error(res?.message || '加载项目审计列表失败');
                setItems([]);
                setTotal(0);
                return;
            }
            const parsed = extractListData(res);
            setItems(parsed.list || []);
            setTotal(parsed.total || 0);
        } catch {
            message.error('加载项目审计列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [page, status]);

    const columns: ColumnsType<AdminProjectAuditItem> = useMemo(() => ([
        {
            title: '审计ID',
            dataIndex: 'id',
            width: 90,
        },
        {
            title: '项目ID',
            dataIndex: 'projectId',
            width: 100,
        },
        {
            title: '审计类型',
            dataIndex: 'auditType',
            width: 120,
            render: (value: string) => PROJECT_AUDIT_TYPE_LABELS[value] || value,
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 120,
            render: (value: string) => {
                const config = PROJECT_AUDIT_STATUS_META[value] || { text: value, color: 'default' };
                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '结论',
            dataIndex: 'conclusion',
            render: (value: string | undefined) => value ? (PROJECT_AUDIT_CONCLUSION_LABELS[value] || value) : '-',
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value: string) => formatServerDateTime(value),
        },
        {
            title: '操作',
            key: 'action',
            width: 220,
            render: (_value, record) => (
                <Space>
                    <Button type="link" onClick={() => navigate(`/project-audits/${record.id}`)}>
                        详情
                    </Button>
                    {record.status !== 'completed' && hasPermission('risk:arbitration:judge') ? (
                        <Button type="link" onClick={() => navigate(`/project-audits/${record.id}/arbitrate`)}>
                            仲裁
                        </Button>
                    ) : null}
                </Space>
            ),
        },
    ]), [navigate]);

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="项目审计"
                description="集中处理项目争议与退款相关审计单。"
                extra={(
                    <Space>
                        <Select
                            allowClear
                            value={status}
                            onChange={setStatus}
                            placeholder="状态"
                            style={{ width: 160 }}
                            options={PROJECT_AUDIT_STATUS_OPTIONS}
                        />
                        <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
                            刷新
                        </Button>
                    </Space>
                )}
            />

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={items}
                    columns={columns}
                    locale={{
                        emptyText: <Empty description="暂无项目审计记录" />,
                    }}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (value) => `共 ${value} 条`,
                    }}
                />
            </Card>
        </div>
    );
};

export default ProjectAuditList;
