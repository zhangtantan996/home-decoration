import React, { useEffect, useState } from 'react';
import { Table, Card, Button, message, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { adminLogApi } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';

interface AdminLog {
    id: number;
    adminId: number;
    adminName: string; // 添加管理员名称字段
    action: string;
    targetType: string; // 前端字段名已修正
    targetId: number;   // 前端字段名已修正
    detail: string;
    ip: string;
    createdAt: string;
}

const LogList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [actionFilter, setActionFilter] = useState<string | undefined>();

    useEffect(() => {
        loadData();
    }, [page, actionFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminLogApi.list({ page, pageSize, action: actionFilter }) as any;
            if (res.code === 0) {
                setLogs(res.data.list || []);
                setTotal(res.data.total || 0);
            }
        } catch (error) {
            console.error(error);
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '管理员', dataIndex: 'adminName' }, // 改为显示管理员名称
        {
            title: '操作',
            dataIndex: 'action',
            render: (val: string) => (
                <StatusTag
                    status={val === 'create' ? 'approved' : val === 'delete' ? 'rejected' : val === 'verify' ? 'warning' : 'info'}
                    text={val}
                />
            ),
        },
        { title: '目标类型', dataIndex: 'targetType' },
        { title: '目标ID', dataIndex: 'targetId' },
        { title: 'IP', dataIndex: 'ip' },
        {
            title: '时间',
            dataIndex: 'createdAt',
            render: (val: string) => val ? new Date(val).toLocaleString() : '-',
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="操作日志"
                description="查看后台关键操作轨迹，便于审计回溯与异常排查。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                <Select
                    placeholder="操作类型"
                    allowClear
                    style={{ width: 120 }}
                    value={actionFilter}
                    onChange={setActionFilter}
                    options={[
                        { value: 'create', label: '创建' },
                        { value: 'update', label: '更新' },
                        { value: 'delete', label: '删除' },
                        { value: 'verify', label: '审核' },
                        { value: 'login', label: '登录' },
                    ]}
                />
                <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    columns={columns}
                    dataSource={logs}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        onChange: setPage,
                        showTotal: (t) => `共 ${t} 条`,
                    }}
                />
            </Card>
        </div>
    );
};

export default LogList;
