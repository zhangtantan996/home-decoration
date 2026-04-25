import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, message } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { adminProjectApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { ADMIN_BUSINESS_STAGE_META, ADMIN_PROJECT_STAGE_FILTERS, ADMIN_PROJECT_STATUS_META, isSecurityAuditorRole } from '../../constants/statuses';
import { useAuthStore } from '../../stores/authStore';

interface ProjectItem {
    id: number;
    name: string;
    ownerName?: string;
    providerName?: string;
    currentPhase?: string;
    businessStage?: string;
    flowSummary?: string;
    budget?: number;
    status: number;
}

interface ProjectListResponse {
    code: number;
    data?: {
        list?: ProjectItem[];
        total?: number;
        stageStats?: Record<string, number>;
    };
    message?: string;
}

const ProjectList: React.FC = () => {
    const navigate = useNavigate();
    const adminRoles = useAuthStore((state) => state.admin?.roles || []);
    const readonlyMode = isSecurityAuditorRole(adminRoles);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [total, setTotal] = useState(0);
    const [keyword, setKeyword] = useState('');
    const [businessStage, setBusinessStage] = useState<string | undefined>();
    const [stageStats, setStageStats] = useState<Record<string, number>>({});
    const [page, setPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        void fetchProjects();
    }, []);

    const fetchProjects = async (options?: {
        keyword?: string;
        businessStage?: string | undefined;
        page?: number;
    }) => {
        const hasKeyword = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'keyword'));
        const hasBusinessStage = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'businessStage'));
        const nextKeyword = hasKeyword ? options?.keyword ?? '' : keyword;
        const nextBusinessStage = hasBusinessStage ? options?.businessStage : businessStage;
        const nextPage = options?.page ?? page;

        setLoading(true);
        try {
            const payload = await adminProjectApi.list({
                page: nextPage,
                pageSize,
                keyword: nextKeyword.trim() || undefined,
                businessStage: nextBusinessStage,
            }) as unknown as ProjectListResponse | undefined;
            if (payload?.code === 0) {
                setProjects(payload.data?.list || []);
                setTotal(payload.data?.total || 0);
                setStageStats(payload.data?.stageStats || {});
                setPage(nextPage);
                return;
            }

            message.error(payload?.message || '加载工地列表失败');
        } catch (error) {
            console.error(error);
            message.error(error instanceof Error ? error.message : '加载工地列表失败');
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
            title: '闭环阶段',
            dataIndex: 'businessStage',
            key: 'businessStage',
            render: (value: string | undefined, record: ProjectItem) => {
                const mapped = value ? ADMIN_BUSINESS_STAGE_META[value] : undefined;
                return (
                <Space direction="vertical" size={2}>
                    <span>{mapped?.text || value || '-'}</span>
                    {record.flowSummary ? <span style={{ fontSize: 12, color: '#64748b' }}>{record.flowSummary}</span> : null}
                </Space>
                );
            },
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
                const mapped = ADMIN_PROJECT_STATUS_META[status];
                return <Tag color={mapped?.color}>{mapped?.text || '-'}</Tag>;
            },
        },
        {
            title: '操作',
            key: 'action',
            render: (_: unknown, record: ProjectItem) => (
                <Space size={4}>
                    <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/projects/detail/${record.id}`)}>查看</Button>
                    {!readonlyMode && record.businessStage === 'construction_party_pending' ? (
                        <>
                            <Button type="link" onClick={() => navigate(`/projects/detail/${record.id}?action=construction`)}>
                                项目内施工协调
                            </Button>
                        </>
                    ) : null}
                    {!readonlyMode && (record.businessStage === 'construction_party_pending' || record.businessStage === 'construction_quote_pending') ? (
                        <>
                            <Button type="link" onClick={() => navigate(`/projects/detail/${record.id}?action=quote`)}>
                                项目内报价干预
                            </Button>
                        </>
                    ) : null}
                </Space>
            )
        },
    ];

    return (
        <Card
            title="工地列表"
            extra={
                <Space>
                    <Input
                        placeholder="搜索项目"
                        prefix={<SearchOutlined />}
                        style={{ width: 200 }}
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        onPressEnter={() => void fetchProjects({ page: 1 })}
                    />
                    <Select
                        allowClear
                        placeholder="闭环阶段"
                        style={{ width: 180 }}
                        value={businessStage}
                        onChange={(value) => {
                            setBusinessStage(value);
                            void fetchProjects({ businessStage: value, page: 1 });
                        }}
                        options={ADMIN_PROJECT_STAGE_FILTERS}
                    />
                    <Button onClick={() => void fetchProjects({ page: 1 })}>
                        搜索
                    </Button>
                    <Button onClick={() => {
                        setKeyword('');
                        setBusinessStage(undefined);
                        void fetchProjects({ keyword: '', businessStage: undefined, page: 1 });
                    }}>
                        重置
                    </Button>
                    {!readonlyMode ? <Button type="primary">导出</Button> : null}
                </Space>
            }
        >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                    { key: '', label: '全部项目', count: total },
                    ...ADMIN_PROJECT_STAGE_FILTERS.map((item) => ({
                        key: item.value,
                        label: item.label,
                        count: stageStats[item.value] || 0,
                    })),
                ].map((item) => (
                    <Button
                        key={item.key || 'all'}
                        type={businessStage === (item.key || undefined) ? 'primary' : 'default'}
                        onClick={() => {
                            const nextStage = item.key || undefined;
                            setBusinessStage(nextStage);
                            void fetchProjects({ businessStage: nextStage, page: 1 });
                        }}
                    >
                        {item.label}（{item.count}）
                    </Button>
                ))}
            </div>
            <Table
                dataSource={projects}
                columns={columns}
                rowKey="id"
                loading={loading}
                scroll={{ x: 'max-content' }}
                pagination={{
                    current: page,
                    total,
                    pageSize,
                    onChange: (nextPage) => {
                        void fetchProjects({ page: nextPage });
                    },
                }}
            />
        </Card>
    );
};

export default ProjectList;
