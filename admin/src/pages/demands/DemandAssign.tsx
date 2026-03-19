import React, { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Space, Table, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';

import { adminDemandApi, type AdminDemandCandidate, type AdminDemandDetail } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import StatusTag from '../../components/StatusTag';

const DemandAssign: React.FC = () => {
    const params = useParams();
    const navigate = useNavigate();
    const demandId = Number(params.id || 0);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [detail, setDetail] = useState<AdminDemandDetail | null>(null);
    const [candidates, setCandidates] = useState<AdminDemandCandidate[]>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [detailRes, candidateRes] = await Promise.all([
                adminDemandApi.detail(demandId),
                adminDemandApi.candidates(demandId, { page: 1, pageSize: 20 }),
            ]);
            if (detailRes.code === 0 && detailRes.data) {
                setDetail(detailRes.data);
            } else {
                message.error(detailRes.message || '加载需求详情失败');
            }
            if (candidateRes.code === 0) {
                setCandidates(candidateRes.data?.list || []);
            } else {
                message.error(candidateRes.message || '加载候选商家失败');
            }
        } catch {
            message.error('加载分配页失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [demandId]);

    const assign = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请先选择至少一个商家');
            return;
        }
        try {
            setAssigning(true);
            const res = await adminDemandApi.assign(demandId, {
                providerIds: selectedRowKeys.map((item) => Number(item)),
                responseDeadlineHours: 48,
            });
            if (res.code === 0) {
                message.success(`已分配 ${res.data?.count || 0} 个商家`);
                navigate('/demands/list');
            } else {
                message.error(res.message || '分配失败');
            }
        } catch {
            message.error('分配失败');
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="需求分配"
                description="根据需求画像与候选商家匹配分，快速完成邀约与分配。"
                extra={(
                    <Space>
                        <Button onClick={() => navigate('/demands/list')}>返回列表</Button>
                        <Button type="primary" loading={assigning} onClick={() => void assign()}>
                            分配给已选商家
                        </Button>
                    </Space>
                )}
            />

            <Card loading={loading} className="hz-panel-card">
                {detail ? (
                    <Descriptions bordered column={2}>
                        <Descriptions.Item label="需求标题" span={2}>{detail.title}</Descriptions.Item>
                        <Descriptions.Item label="状态">
                            <StatusTag status="info" text={detail.status} />
                        </Descriptions.Item>
                        <Descriptions.Item label="需求类型">{detail.demandType}</Descriptions.Item>
                        <Descriptions.Item label="区域">{detail.city} / {detail.district}</Descriptions.Item>
                        <Descriptions.Item label="面积">{detail.area}㎡</Descriptions.Item>
                        <Descriptions.Item label="预算" span={2}>¥{Math.round(detail.budgetMin)} - ¥{Math.round(detail.budgetMax)}</Descriptions.Item>
                        <Descriptions.Item label="需求描述" span={2}>{detail.description || '未填写'}</Descriptions.Item>
                    </Descriptions>
                ) : null}
            </Card>

            <Card className="hz-table-card" title="候选商家">
                <Table
                    rowKey={(record) => record.provider.id}
                    loading={loading}
                    dataSource={candidates}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    columns={[
                        { title: '服务商', render: (_: unknown, record: AdminDemandCandidate) => record.provider.name },
                        {
                            title: '认证',
                            render: (_: unknown, record: AdminDemandCandidate) => (
                                record.provider.verified
                                    ? <StatusTag status="approved" text="已认证" />
                                    : <StatusTag status="warning" text="未认证" />
                            ),
                        },
                        { title: '评分', render: (_: unknown, record: AdminDemandCandidate) => record.provider.rating.toFixed(1) },
                        { title: '完工量', render: (_: unknown, record: AdminDemandCandidate) => record.provider.completedCnt },
                        { title: '匹配分', dataIndex: 'matchScore' },
                        { title: '推荐理由', render: (_: unknown, record: AdminDemandCandidate) => record.scoreReason.join(' / ') || '基础排序' },
                    ]}
                    pagination={false}
                />
            </Card>
        </div>
    );
};

export default DemandAssign;
