import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, message } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { adminProjectApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface ProjectItem {
    id: number;
    name: string;
    ownerName?: string;
    providerName?: string;
    currentPhase?: string;
    budget?: number;
    status: number;
}

interface ProjectListResponse {
    code: number;
    data?: ProjectItem[];
    total?: number;
}

const ProjectList: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        void fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const response = await adminProjectApi.list({ page: 1, pageSize: 10 });
            const payload = response.data as ProjectListResponse | undefined;
            if (payload?.code === 0) {
                setProjects(payload.data || []);
                setTotal(payload.total || 0);
                return;
            }

            message.error('加载工地列表失败');
        } catch (error) {
            console.error(error);
            message.error('加载工地列表失败');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: '项目ID', dataIndex: 'id', key: 'id', width: 80 },
        { title: '项目名称', dataIndex: 'name', key: 'name' },
        { title: '业主名', dataIndex: 'ownerName', key: 'ownerName' },
        { title: '服务商', dataIndex: 'providerName', key: 'providerName' },
        {
            title: '当前阶段',
            dataIndex: 'currentPhase',
            key: 'currentPhase',
            render: (value?: string) => value || '-',
        },
        {
            title: '预算',
            dataIndex: 'budget',
            key: 'budget',
            render: (value?: number) => value?.toLocaleString() || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: number) => {
                const map: Record<number, { color: string; text: string }> = {
                    0: { color: 'blue', text: '进行中' },
                    1: { color: 'green', text: '已完工' },
                    2: { color: 'orange', text: '已暂停' },
                };
                return <Tag color={map[status]?.color}>{map[status]?.text || '-'}</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_: unknown, record: ProjectItem) => (
                <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/projects/detail/${record.id}`)}>查看</Button>
            ),
        },
    ];

    return (
        <Card
            title="工地列表"
            extra={
                <Space>
                    <Input placeholder="搜索项目" prefix={<SearchOutlined />} style={{ width: 200 }} />
                    <Button type="primary">导出</Button>
                </Space>
            }
        >
            <Table
                dataSource={projects}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{ total, pageSize: 10 }}
            />
        </Card>
    );
};

export default ProjectList;
