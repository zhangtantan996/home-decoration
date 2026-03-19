import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Empty, Input, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ToolbarCard from '../../components/ToolbarCard';
import StatusTag from '../../components/StatusTag';
import { adminAuditLogApi, type AdminAuditLogQuery, type AdminAuditLogRecord } from '../../services/api';

const { RangePicker } = DatePicker;

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const pretty = (value: unknown) => {
    if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
        return '-';
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const AuditLogList: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [records, setRecords] = useState<AdminAuditLogRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [operationType, setOperationType] = useState('');
    const [resourceType, setResourceType] = useState('');
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

    const query = useMemo<AdminAuditLogQuery>(() => ({
        page,
        pageSize,
        operationType: operationType || undefined,
        resourceType: resourceType || undefined,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
    }), [dateRange, operationType, page, pageSize, resourceType]);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await adminAuditLogApi.list(query);
            if (res.code === 0) {
                setRecords(res.data?.list || []);
                setTotal(res.data?.total || 0);
            } else {
                message.error(res.message || '加载审计日志失败');
            }
        } catch (error) {
            console.error(error);
            message.error('加载审计日志失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, [query]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await adminAuditLogApi.export({
                operationType: operationType || undefined,
                resourceType: resourceType || undefined,
                startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
                endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
            });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadBlob(blob, `audit-logs-${timestamp}.csv`);
            message.success('审计日志已导出');
        } catch (error) {
            console.error(error);
            message.error('导出审计日志失败');
        } finally {
            setExporting(false);
        }
    };

    const columns: ColumnsType<AdminAuditLogRecord> = [
        {
            title: '日志ID',
            dataIndex: 'id',
            width: 88,
        },
        {
            title: '记录类型',
            dataIndex: 'recordKind',
            width: 110,
            render: (value?: string) => (
                <StatusTag
                    status={value === 'business' ? 'approved' : 'info'}
                    text={value === 'business' ? '业务审计' : value || '请求日志'}
                />
            ),
        },
        {
            title: '操作者',
            key: 'operator',
            render: (_, record) => `${record.operatorType || '-'} / ${record.operatorId || '-'}`,
        },
        {
            title: '操作类型',
            dataIndex: 'operationType',
            render: (value?: string) => value || recordActionFallback,
        },
        {
            title: '资源',
            key: 'resource',
            render: (_, record) => `${record.resourceType || '-'} / ${record.resourceId || '-'}`,
        },
        {
            title: '结果',
            dataIndex: 'result',
            width: 120,
            render: (value?: string) => value || '-',
        },
        {
            title: '时间',
            dataIndex: 'createdAt',
            width: 180,
            render: (value?: string) => formatDateTime(value),
        },
    ];

    return (
        <div className="hz-page-stack">
            <PageHeader
                title="审计留痕"
                description="按操作类型、资源类型和时间范围追溯关键业务决策。"
            />

            <ToolbarCard>
                <div className="hz-toolbar">
                    <Input
                        style={{ width: 180 }}
                        value={operationType}
                        onChange={(event) => {
                            setPage(1);
                            setOperationType(event.target.value.trim());
                        }}
                        placeholder="操作类型，如 freeze_funds"
                    />
                    <Input
                        style={{ width: 160 }}
                        value={resourceType}
                        onChange={(event) => {
                            setPage(1);
                            setResourceType(event.target.value.trim());
                        }}
                        placeholder="资源类型，如 project"
                    />
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => {
                            setPage(1);
                            setDateRange(dates as [Dayjs, Dayjs] | null);
                        }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>刷新</Button>
                    <Button icon={<DownloadOutlined />} onClick={() => void handleExport()} loading={exporting}>导出</Button>
                </div>
            </ToolbarCard>

            <Card className="hz-table-card">
                <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={records}
                    locale={{ emptyText: <Empty description="暂无审计记录" /> }}
                    columns={columns}
                    expandable={{
                        expandedRowRender: (record) => (
                            <div style={{ display: 'grid', gap: 12 }}>
                                <div>
                                    <strong>原因</strong>
                                    <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{record.reason || '-'}</pre>
                                </div>
                                <div>
                                    <strong>操作前</strong>
                                    <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{pretty(record.beforeState)}</pre>
                                </div>
                                <div>
                                    <strong>操作后</strong>
                                    <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{pretty(record.afterState)}</pre>
                                </div>
                                <div>
                                    <strong>元数据</strong>
                                    <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{pretty(record.metadata)}</pre>
                                </div>
                            </div>
                        ),
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

const recordActionFallback = '-';

export default AuditLogList;
