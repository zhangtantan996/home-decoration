import React from 'react';
import { Card, Table, Tag, Button, Space, Input } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';

import { projectApi } from '../../services/api';
import { useEffect, useState } from 'react';

const ProjectList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await projectApi.list({ page: 1, pageSize: 10 });
            if (res.code === 0) {
                setProjects(res.data.list || []);
                setTotal(res.data.total);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: '项目ID', dataIndex: 'id', key: 'id', width: 80 },
        { title: '项目名称', dataIndex: 'name', key: 'name' },
        { title: '业主名', dataIndex: 'ownerName', key: 'ownerName' },     // 后端返回 ownerName
        { title: '服务商', dataIndex: 'providerName', key: 'providerName' }, // 后端返回 providerName
        { title: '当前阶段', dataIndex: 'currentPhase', key: 'currentPhase', render: (val: number) => ['准备', '开工', '水电', '泥木', '油漆', '竣工'][val] },
        {
            title: '预算',
            dataIndex: 'budget',
            key: 'budget',
            render: (val: number) => val?.toLocaleString(),
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
                return <Tag color={map[status]?.color}>{map[status]?.text}</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            render: () => (
                <Button type="link" icon={<EyeOutlined />}>查看</Button>
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
