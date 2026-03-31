import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Modal, Descriptions } from 'antd';
import { ArrowLeftOutlined, FileAddOutlined, EyeOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantBookingApi } from '../../services/merchantApi';
import { useDictStore } from '../../stores/dictStore';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantSectionCard from '../../components/MerchantSectionCard';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import sharedStyles from '../../components/MerchantPage.module.css';
import { BOOKING_STATUS_META } from '../../constants/statuses';

interface Booking {
    id: number;
    userId: number;
    address: string;
    area: number;
    houseLayout: string;
    renovationType: string;
    budgetRange: string;
    preferredDate: string;
    phone: string;
    notes: string;
    status: number;
    createdAt: string;
    userName?: string;
    userPhone?: string;
    hasProposal?: boolean;
}

const MerchantBookings: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [detailVisible, setDetailVisible] = useState(false);
    const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
    const navigate = useNavigate();

    const { loadDict, getDictOptions } = useDictStore();

    useEffect(() => {
        loadBookings();
        loadDict('renovation_type');
        loadDict('budget_range');
    }, [loadDict]);

    // 获取字典映射
    const getRenovationTypeLabel = (value: string) => {
        const options = getDictOptions('renovation_type');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const getBudgetRangeLabel = (value: string) => {
        const options = getDictOptions('budget_range');
        const option = options.find(opt => opt.value === value);
        return option?.label || value;
    };

    const loadBookings = async () => {
        try {
            const res = await merchantBookingApi.list() as any;
            if (res.code === 0) {
                setBookings(res.data.list || []);
            }
        } catch (error) {
            message.error('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const showDetail = (record: Booking) => {
        setCurrentBooking(record);
        setDetailVisible(true);
    };

    const handleBooking = async (id: number, action: 'confirm' | 'reject') => {
        try {
            const res = await merchantBookingApi.handle(id, action) as any;
            if (res.code === 0) {
                message.success(action === 'confirm' ? '已接单' : '已拒绝');
                loadBookings();
            } else {
                message.error(res.message || '操作失败');
            }
        } catch (error) {
            message.error('操作失败');
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '地址', dataIndex: 'address', ellipsis: true },
        { title: '面积', dataIndex: 'area', render: (v: number) => `${v}㎡` },
        { title: '户型', dataIndex: 'houseLayout' },
        { title: '装修类型', dataIndex: 'renovationType' },
        { title: '预算', dataIndex: 'budgetRange' },
        { title: '预约时间', dataIndex: 'preferredDate', width: 160 },
        {
            title: '状态',
            dataIndex: 'status',
            render: (status: number) => {
                const s = BOOKING_STATUS_META[status] || { text: '未知', color: 'default' };
                return <Tag color={s.color}>{s.text}</Tag>;
            },
        },
        {
            title: '操作',
            width: 260,
            render: (_: any, record: Booking) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => showDetail(record)}
                    >
                        详情
                    </Button>
                    {record.status === 1 && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => handleBooking(record.id, 'confirm')}
                            >
                                接单
                            </Button>
                            <Button
                                danger
                                size="small"
                                onClick={() => {
                                    Modal.confirm({
                                        title: '确认拒单',
                                        content: '确定要拒绝这条预约吗？操作后不可撤销。',
                                        onOk: () => handleBooking(record.id, 'reject')
                                    });
                                }}
                            >
                                拒单
                            </Button>
                        </>
                    )}
                    {record.status === 2 && (
                        <Button
                            type="primary"
                            ghost
                            size="small"
                            icon={<FileAddOutlined />}
                            onClick={() => navigate(`/bookings/${record.id}/design-workflow`)}
                        >
                            {(record as any).hasProposal ? '继续跟进' : '推进流程'}
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <>
            <MerchantPageShell>
                <MerchantPageHeader
                    title="预约管理"
                    description="处理用户预约需求，确认接单后可继续录入方案并推进后续签约。"
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

            {/* 预约详情弹窗 */}
            <Modal
                title="预约详情"
                open={detailVisible}
                onCancel={() => setDetailVisible(false)}
                footer={
                    currentBooking ? (
                        <Space>
                            {currentBooking.status >= 2 ? (
                                <>
                                    <Button onClick={() => {
                                        setDetailVisible(false);
                                        navigate(`/bookings/${currentBooking.id}/site-survey`);
                                    }}>
                                        量房记录
                                    </Button>
                                    <Button onClick={() => {
                                        setDetailVisible(false);
                                        navigate(`/bookings/${currentBooking.id}/budget-confirm`);
                                    }}>
                                        预算确认
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<CheckCircleOutlined />}
                                        onClick={() => {
                                            setDetailVisible(false);
                                            navigate(`/bookings/${currentBooking.id}/design-workflow`);
                                        }}
                                    >
                                        进入设计流程
                                    </Button>
                                </>
                            ) : null}
                            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
                        </Space>
                    ) : (
                        <Button onClick={() => setDetailVisible(false)}>关闭</Button>
                    )
                }
                width={640}
            >
                {currentBooking && (
                    <Descriptions column={2} bordered size="small">
                        <Descriptions.Item label="预约ID">{currentBooking.id}</Descriptions.Item>
                        <Descriptions.Item label="用户">
                            {(currentBooking as any).userNickname || `用户${currentBooking.userId}`}
                        </Descriptions.Item>
                        <Descriptions.Item label="地址" span={2}>{currentBooking.address}</Descriptions.Item>
                        <Descriptions.Item label="面积">{currentBooking.area}㎡</Descriptions.Item>
                        <Descriptions.Item label="户型">{currentBooking.houseLayout}</Descriptions.Item>
                        <Descriptions.Item label="装修类型">
                            {getRenovationTypeLabel(currentBooking.renovationType)}
                        </Descriptions.Item>
                        <Descriptions.Item label="预算范围">
                            {getBudgetRangeLabel(currentBooking.budgetRange)}
                        </Descriptions.Item>
                        <Descriptions.Item label="预约时间">{currentBooking.preferredDate}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{currentBooking.phone}</Descriptions.Item>
                        <Descriptions.Item label="状态" span={2}>
                            <Tag color={BOOKING_STATUS_META[currentBooking.status]?.color}>
                                {BOOKING_STATUS_META[currentBooking.status]?.text}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="备注" span={2}>{currentBooking.notes || '-'}</Descriptions.Item>
                        <Descriptions.Item label="创建时间" span={2}>{currentBooking.createdAt}</Descriptions.Item>
                    </Descriptions>
                )}
            </Modal>
        </>
    );
};

export default MerchantBookings;
