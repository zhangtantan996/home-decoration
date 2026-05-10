import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Input, Select, Space, Modal, message, Tag, Descriptions, Image, Typography } from 'antd';
import dayjs from 'dayjs';

import AdminReauthModal from '../../components/AdminReauthModal';

import {
    adminSupervisorApplicationApi,
    type AdminSupervisorApplicationItem,
} from '../../services/api_supervisor';
import styles from './SupervisorPages.module.css';

const { Text } = Typography;

type ReauthPayload = { reason?: string; recentReauthProof: string };
type PendingReviewAction =
    | { type: 'approve'; app: AdminSupervisorApplicationItem }
    | { type: 'reject'; app: AdminSupervisorApplicationItem; rejectReason: string };

const STATUS_MAP: Record<number, { label: string; color: string }> = {
    0: { label: '待审核', color: 'orange' },
    1: { label: '已通过', color: 'green' },
    2: { label: '已拒绝', color: 'red' },
};

const ApplicationReview: React.FC = () => {
    const [items, setItems] = useState<AdminSupervisorApplicationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('0');
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [selectedApp, setSelectedApp] = useState<AdminSupervisorApplicationItem | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [viewingApp, setViewingApp] = useState<AdminSupervisorApplicationItem | null>(null);
    const [reauthOpen, setReauthOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingReviewAction | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminSupervisorApplicationApi.list({
                page,
                pageSize: 10,
                keyword: keyword || undefined,
                status: statusFilter || undefined,
            });
            if (res.code !== 0) {
                message.error(res.message || '加载申请列表失败');
                return;
            }
            setItems(res.data?.list || []);
            setTotal(res.data?.total || 0);
        } catch {
            message.error('加载申请列表失败');
        } finally {
            setLoading(false);
        }
    }, [page, keyword, statusFilter]);

    useEffect(() => { void loadData(); }, [loadData]);

    const requestApprove = (app: AdminSupervisorApplicationItem) => {
        setPendingAction({ type: 'approve', app });
        setReauthOpen(true);
    };

    const handleReauthConfirmed = async (payload: ReauthPayload) => {
        if (!pendingAction) return;
        setLoading(true);
        try {
            const res = pendingAction.type === 'approve'
                ? await adminSupervisorApplicationApi.approve(pendingAction.app.id, {
                    reason: payload.reason,
                    recentReauthProof: payload.recentReauthProof,
                })
                : await adminSupervisorApplicationApi.reject(pendingAction.app.id, {
                    rejectReason: pendingAction.rejectReason,
                    reason: payload.reason,
                    recentReauthProof: payload.recentReauthProof,
            });
            if (res.code !== 0) {
                throw new Error(res.message || '操作失败');
            }
            message.success(pendingAction.type === 'approve' ? '已通过审核' : '已拒绝申请');
            setRejectModalVisible(false);
            setSelectedApp(null);
            setRejectReason('');
            setPendingAction(null);
            await loadData();
        } catch (error) {
            throw error instanceof Error ? error : new Error('操作异常');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedApp || !rejectReason.trim()) {
            message.warning('请填写拒绝原因');
            return;
        }
        setPendingAction({ type: 'reject', app: selectedApp, rejectReason: rejectReason.trim() });
        setReauthOpen(true);
    };

    const parseFormDetail = (formJson: string) => {
        try {
            const data = JSON.parse(formJson);
            return {
                realName: data.realName || '-',
                cityCode: data.cityCode || '-',
                orgName: data.orgName || '-',
                idNo: data.idNo || '-',
                serviceArea: data.serviceArea || [],
                certifications: data.certifications || [],
            };
        } catch {
            return {
                realName: '-',
                cityCode: '-',
                orgName: '-',
                idNo: '-',
                serviceArea: [],
                certifications: [],
            };
        }
    };

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '手机号', dataIndex: 'phone', width: 130 },
        {
            title: '姓名', key: 'realName', width: 100,
            render: (_: unknown, record: AdminSupervisorApplicationItem) => parseFormDetail(record.formJson).realName,
        },
        {
            title: '城市', key: 'cityCode', width: 80,
            render: (_: unknown, record: AdminSupervisorApplicationItem) => parseFormDetail(record.formJson).cityCode,
        },
        {
            title: '状态', dataIndex: 'status', width: 80,
            render: (value: number) => {
                const meta = STATUS_MAP[value] || { label: '未知', color: 'default' };
                return <Tag color={meta.color}>{meta.label}</Tag>;
            },
        },
        {
            title: '提交时间', dataIndex: 'submittedAt', width: 160,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
        },
        { title: '白名单备注', dataIndex: 'whitelistNote', ellipsis: true, width: 120 },
        {
            title: '操作', key: 'actions', width: 200,
            render: (_: unknown, record: AdminSupervisorApplicationItem) => (
                <Space>
                    <Button size="small" onClick={() => { setViewingApp(record); setDetailModalVisible(true); }}>详情</Button>
                    {record.status === 0 && (
                        <>
                            <Button type="primary" size="small" onClick={() => requestApprove(record)}>通过</Button>
                            <Button danger size="small" onClick={() => { setSelectedApp(record); setRejectModalVisible(true); }}>拒绝</Button>
                        </>
                    )}
                    {record.status !== 0 && <Tag>{STATUS_MAP[record.status]?.label || '已处理'}</Tag>}
                </Space>
            ),
        },
    ];

    return (
        <div className={styles.page}>
            <div className={styles.toolbarHeader}>
                <Space>
                    <Input.Search
                        placeholder="搜索手机号"
                        allowClear
                        className={styles.wideSearchInput}
                        onSearch={(value) => { setPage(1); setKeyword(value); }}
                    />
                    <Select
                        placeholder="状态"
                        className={styles.statusSelect}
                        value={statusFilter}
                        onChange={(value) => { setPage(1); setStatusFilter(value); }}
                        options={[
                            { label: '全部', value: '' },
                            { label: '待审核', value: '0' },
                            { label: '已通过', value: '1' },
                            { label: '已拒绝', value: '2' },
                        ]}
                    />
                </Space>
            </div>

            <Table
                rowKey="id"
                columns={columns}
                dataSource={items}
                loading={loading}
                pagination={{
                    current: page,
                    pageSize: 10,
                    total,
                    onChange: (nextPage) => setPage(nextPage),
                }}
            />

            <Modal
                title="拒绝监理申请"
                open={rejectModalVisible}
                onOk={() => void handleReject()}
                onCancel={() => { setRejectModalVisible(false); setSelectedApp(null); setRejectReason(''); }}
            >
                <div className={styles.modalHint}>手机号：{selectedApp?.phone}</div>
                <Input.TextArea
                    rows={3}
                    placeholder="请填写拒绝原因"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                />
            </Modal>

            <Modal
                title="申请详情"
                open={detailModalVisible}
                footer={[
                    <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>,
                    viewingApp?.status === 0 && (
                        <Button key="reject" danger onClick={() => { setDetailModalVisible(false); setSelectedApp(viewingApp); setRejectModalVisible(true); }}>
                            拒绝
                        </Button>
                    ),
                    viewingApp?.status === 0 && (
                        <Button key="approve" type="primary" onClick={() => { setDetailModalVisible(false); requestApprove(viewingApp); }}>
                            通过审核
                        </Button>
                    )
                ]}
                onCancel={() => setDetailModalVisible(false)}
                width={800}
            >
                {viewingApp && (() => {
                    const detail = parseFormDetail(viewingApp.formJson);
                    return (
                        <Descriptions size="small" column={2} bordered>
                            <Descriptions.Item label="真实姓名">{detail.realName}</Descriptions.Item>
                            <Descriptions.Item label="身份证号">{detail.idNo}</Descriptions.Item>
                            <Descriptions.Item label="手机号">{viewingApp.phone}</Descriptions.Item>
                            <Descriptions.Item label="服务城市">{detail.cityCode}</Descriptions.Item>
                            <Descriptions.Item label="所属机构">{detail.orgName}</Descriptions.Item>
                            <Descriptions.Item label="当前状态">
                                <Tag color={STATUS_MAP[viewingApp.status]?.color}>{STATUS_MAP[viewingApp.status]?.label}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="服务范围 (区/县)" span={2}>
                                <Space wrap>
                                    {(detail.serviceArea || []).map((area: string) => (
                                        <Tag key={area} color="blue">{area}</Tag>
                                    ))}
                                    {(!detail.serviceArea || detail.serviceArea.length === 0) && '-'}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label="资质证明图片" span={2}>
                                <Image.PreviewGroup>
                                    <Space wrap size={12}>
                                        {(detail.certifications || []).map((url: string, idx: number) => (
                                            <Image
                                                key={idx}
                                                width={160}
                                                height={100}
                                                src={url}
                                                className={styles.certificationImage}
                                            />
                                        ))}
                                        {(!detail.certifications || detail.certifications.length === 0) && <Text type="secondary">未上传图片</Text>}
                                    </Space>
                                </Image.PreviewGroup>
                            </Descriptions.Item>
                            <Descriptions.Item label="申请编号">{viewingApp.id}</Descriptions.Item>
                            <Descriptions.Item label="提交时间">{dayjs(viewingApp.submittedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
                            {viewingApp.rejectReason ? (
                                <Descriptions.Item label="拒绝原因" span={2}>
                                    <Text type="danger">{viewingApp.rejectReason}</Text>
                                </Descriptions.Item>
                            ) : null}
                        </Descriptions>
                    );
                })()}
            </Modal>

            <AdminReauthModal
                open={reauthOpen}
                title={pendingAction?.type === 'approve' ? '通过监理申请' : '拒绝监理申请'}
                description="监理申请审核会影响账号开通和登录资格，提交前必须再次认证并填写原因。"
                confirmText="确认执行"
                onCancel={() => { setReauthOpen(false); setPendingAction(null); }}
                onConfirmed={handleReauthConfirmed}
            />
        </div>
    );
};

export default ApplicationReview;
