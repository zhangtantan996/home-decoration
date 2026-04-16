import React, { useEffect, useMemo, useState } from 'react';
import {
    Button,
    Collapse,
    Empty,
    Input,
    InputNumber,
    message,
    Modal,
    Space,
    Switch,
    Table,
    Tag,
    Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import { merchantQuoteApi, type QuotePriceBookDetail, type QuotePriceBookItem } from '../../services/quoteApi';
import { normalizePriceCent, normalizePriceYuan, sharedForemanPriceInputProps } from '../../utils/priceInput';
import MerchantPageShell from '../../components/MerchantPageShell';
import MerchantPageHeader from '../../components/MerchantPageHeader';
import MerchantStatGrid, { type MerchantStatItem } from '../../components/MerchantStatGrid';
import MerchantFilterBar from '../../components/MerchantFilterBar';
import MerchantContentPanel from '../../components/MerchantContentPanel';
import styles from './MerchantPriceBook.module.css';

const { Text } = Typography;

type EditablePriceItem = QuotePriceBookItem;

const statusText = (status?: string) => {
    switch (String(status || '').toLowerCase()) {
        case 'active':
            return { text: '已发布', color: 'green' as const };
        case 'draft':
            return { text: '草稿版', color: 'gold' as const };
        case 'archived':
            return { text: '历史版', color: 'default' as const };
        default:
            return { text: status || '-', color: 'default' as const };
    }
};

const MerchantPriceBook: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [onlyUnpriced, setOnlyUnpriced] = useState(false);
    const [onlyRequired, setOnlyRequired] = useState(false);
    const [detail, setDetail] = useState<QuotePriceBookDetail | null>(null);
    const [rows, setRows] = useState<EditablePriceItem[]>([]);

    const load = async () => {
        try {
            setLoading(true);
            const data = await merchantQuoteApi.getPriceBook();
            setDetail(data);
            setRows(data.items || []);
        } catch (error: any) {
            message.error(error?.message || '加载工长价格库失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const filteredRows = useMemo(() => {
        const normalized = keyword.trim().toLowerCase();
        return rows.filter((row) => {
            if (onlyUnpriced && (row.unitPriceCent || 0) > 0) {
                return false;
            }
            if (onlyRequired && !row.required) {
                return false;
            }
            if (!normalized) {
                return true;
            }
            return [row.standardCode, row.standardItemName, row.categoryL1, row.categoryL2, row.unit]
                .some((field) => String(field || '').toLowerCase().includes(normalized));
        });
    }, [keyword, onlyRequired, onlyUnpriced, rows]);

    const applicableRows = useMemo(
        () => rows.filter((row) => row.applicable !== false),
        [rows],
    );
    const pricedCount = useMemo(
        () => applicableRows.filter((row) => (row.unitPriceCent || 0) > 0).length,
        [applicableRows],
    );
    const requiredCount = useMemo(
        () => applicableRows.filter((row) => row.required).length,
        [applicableRows],
    );
    const requiredMissingRows = useMemo(
        () => applicableRows.filter((row) => row.required && (row.unitPriceCent || 0) <= 0),
        [applicableRows],
    );
    const unpricedCount = useMemo(
        () => applicableRows.filter((row) => (row.unitPriceCent || 0) <= 0).length,
        [applicableRows],
    );
    const completionRate = applicableRows.length ? Math.round((pricedCount / applicableRows.length) * 100) : 0;

    const groupedRows = useMemo(() => {
        const groups = new Map<string, EditablePriceItem[]>();
        filteredRows.forEach((row) => {
            const key = row.categoryL1 || '其他';
            const bucket = groups.get(key) || [];
            bucket.push(row);
            groups.set(key, bucket);
        });

        return Array.from(groups.entries())
            .map(([categoryName, items]) => ({
                categoryName,
                items: items.sort((left, right) => {
                    const leftName = `${left.categoryL2 || ''}-${left.standardItemName || ''}`;
                    const rightName = `${right.categoryL2 || ''}-${right.standardItemName || ''}`;
                    return leftName.localeCompare(rightName, 'zh-Hans-CN');
                }),
            }))
            .sort((left, right) => left.categoryName.localeCompare(right.categoryName, 'zh-Hans-CN'));
    }, [filteredRows]);

    const statCards = useMemo<MerchantStatItem[]>(() => [
        {
            label: '当前状态',
            value: statusText(detail?.book.status).text,
            meta: `当前版本：${detail?.book.version || 0}`,
            tone: 'slate',
            percent: 100,
        },
        {
            label: '能力范围项',
            value: `${applicableRows.length || 0}`,
            meta: '当前工种需维护的标准项',
            tone: 'blue',
            percent: 100,
        },
        {
            label: '已填写项',
            value: `${pricedCount}`,
            meta: `/ ${applicableRows.length || 0} 项已录价`,
            tone: 'green',
            percent: completionRate,
        },
        {
            label: '未填写项',
            value: `${unpricedCount}`,
            meta: '当前能力范围内待补充',
            tone: 'amber',
            percent: applicableRows.length ? Math.round((unpricedCount / applicableRows.length) * 100) : 0,
        },
        {
            label: '必填项数量',
            value: `${requiredCount}`,
            meta: '关键报价项',
            tone: 'red',
            percent: applicableRows.length ? Math.round((requiredCount / applicableRows.length) * 100) : 0,
        },
    ], [applicableRows.length, completionRate, detail?.book.status, detail?.book.version, pricedCount, requiredCount, unpricedCount]);

    const columns: ColumnsType<EditablePriceItem> = useMemo(() => [
        {
            title: '二级工序',
            dataIndex: 'categoryL2',
            key: 'categoryL2',
            width: 150,
            render: (value?: string) => value || '-',
        },
        {
            title: '标准项',
            key: 'standardItem',
            render: (_value, record) => (
                <Space direction="vertical" size={2}>
                    <Space size={8} wrap>
                        <Text strong>{record.standardItemName || `标准项 #${record.standardItemId}`}</Text>
                        {record.required ? <Tag color="red">必填</Tag> : <Tag>可选</Tag>}
                        {record.applicable === false ? <Tag>非当前能力范围</Tag> : null}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.standardCode || '-'}
                    </Text>
                </Space>
            ),
        },
        {
            title: '单位',
            dataIndex: 'unit',
            key: 'unit',
            width: 80,
            render: (value?: string) => value || '-',
        },
        {
            title: '单价(元)',
            dataIndex: 'unitPriceCent',
            key: 'unitPriceCent',
            width: 160,
            render: (_value, record) => (
                <InputNumber
                    {...sharedForemanPriceInputProps}
                    className={styles.priceInput}
                    value={(record.unitPriceCent || 0) / 100}
                    onChange={(value) => {
                        const nextCent = normalizePriceCent(value as number | null) ?? 0;
                        setRows((prev) => prev.map((row) =>
                            row.standardItemId === record.standardItemId
                                ? { ...row, unitPriceCent: nextCent }
                                : row
                        ));
                    }}
                    onBlur={(event) => {
                        const normalizedYuan = normalizePriceYuan(Number(event.target.value || 0));
                        const nextCent = normalizePriceCent(normalizedYuan ?? 0) ?? 0;
                        setRows((prev) => prev.map((row) =>
                            row.standardItemId === record.standardItemId
                                ? { ...row, unitPriceCent: nextCent }
                                : row
                        ));
                    }}
                />
            ),
        },
    ], []);

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                remark: detail?.book?.remark || '',
                items: rows
                    .filter((row) => (row.unitPriceCent || 0) > 0)
                    .map((row) => ({
                        standardItemId: row.standardItemId,
                        unit: row.unit,
                        unitPriceCent: row.unitPriceCent,
                        minChargeCent: 0,
                        remark: '',
                        status: 1,
                    })),
            };
            const data = await merchantQuoteApi.savePriceBook(payload);
            setDetail(data);
            setRows(data.items || []);
            message.success('工长价格库已保存');
        } catch (error: any) {
            message.error(error?.message || '保存工长价格库失败');
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (requiredMissingRows.length > 0) {
            message.warning(`当前能力范围内仍有 ${requiredMissingRows.length} 个必填项未填写价格`);
            return;
        }
        Modal.confirm({
            title: '发布价格库',
            content: '发布后，系统会优先用你当前能力范围内的价格库生成施工报价草稿。是否继续？',
            okText: '发布',
            cancelText: '取消',
            onOk: async () => {
                try {
                    setSaving(true);
                    const data = await merchantQuoteApi.publishPriceBook();
                    setDetail(data);
                    setRows(data.items || []);
                    message.success('工长价格库已发布');
                } catch (error: any) {
                    message.error(error?.message || '发布工长价格库失败');
                } finally {
                    setSaving(false);
                }
            },
        });
    };

    return (
        <MerchantPageShell>
            <MerchantPageHeader
                title="工长价格库"
                description="按平台提供的施工标准录入你的报价，保存后可作为后续项目报价的基础价格。"
                extra={(
                    <>
                        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
                            刷新
                        </Button>
                        <Button icon={<SaveOutlined />} onClick={() => void handleSave()} loading={saving}>
                            保存价格
                        </Button>
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => void handlePublish()} loading={saving}>
                            发布价格库
                        </Button>
                    </>
                )}
            />

            <MerchantStatGrid
                items={statCards.map((card) => ({
                    ...card,
                    tag: card.label === '当前状态'
                        ? <Tag color={statusText(detail?.book.status).color}>{statusText(detail?.book.status).text}</Tag>
                        : undefined,
                }))}
            />

            <MerchantFilterBar hint="未填写价格的标准项默认不参与当前价格库发布。">
                <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="搜索标准编码 / 标准项 / 类目"
                    className={styles.searchInput}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                />
                <div className={styles.switchGroup}>
                    <label className={styles.switchChip}>
                        <Switch checked={onlyUnpriced} onChange={setOnlyUnpriced} />
                        <span>只看未填价格项</span>
                    </label>
                    <label className={styles.switchChip}>
                        <Switch checked={onlyRequired} onChange={setOnlyRequired} />
                        <span>只看必填项</span>
                    </label>
                </div>
            </MerchantFilterBar>

            {requiredMissingRows.length > 0 ? (
                <div style={{ marginTop: 12, color: '#d97706', fontSize: 13 }}>
                    发布前需补齐必填项：当前仍有 {requiredMissingRows.length} 项未填写价格。保存草稿不受影响。
                </div>
            ) : null}

            <MerchantContentPanel>
                {groupedRows.length === 0 ? (
                    <Empty description="当前筛选条件下没有可录价的标准项" />
                ) : (
                    <Collapse
                        className={styles.groupCollapse}
                        defaultActiveKey={groupedRows[0]?.categoryName ? [groupedRows[0].categoryName] : []}
                        items={groupedRows.map((group) => {
                            const pricedInGroup = group.items.filter((row) => (row.unitPriceCent || 0) > 0).length;
                            const requiredInGroup = group.items.filter((row) => row.required).length;
                            const progress = group.items.length ? Math.round((pricedInGroup / group.items.length) * 100) : 0;

                            return {
                                key: group.categoryName,
                                label: (
                                    <div className={styles.groupHeader}>
                                        <div className={styles.groupTitleBlock}>
                                            <Text strong className={styles.groupTitle}>{group.categoryName}</Text>
                                            <Text type="secondary" className={styles.groupSubtitle}>
                                                {group.items.length} 项标准施工项
                                            </Text>
                                        </div>
                                        <div className={styles.groupMetrics}>
                                            <Tag>{`${group.items.length} 项`}</Tag>
                                            <Tag color="green">{`已填 ${pricedInGroup}`}</Tag>
                                            {requiredInGroup > 0 ? <Tag color="red">{`必填 ${requiredInGroup}`}</Tag> : null}
                                            <Text className={styles.groupActionHint}>展开详情</Text>
                                            <div className={styles.progressTrack}>
                                                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ),
                                children: (
                                    <Table
                                        rowKey="standardItemId"
                                        dataSource={group.items}
                                        columns={columns}
                                        pagination={false}
                                        className={styles.groupTable}
                                        rowClassName={(record) => {
                                            if (record.required && (record.unitPriceCent || 0) <= 0) return styles.requiredPendingRow;
                                            if ((record.unitPriceCent || 0) <= 0) return styles.pendingRow;
                                            return '';
                                        }}
                                    />
                                ),
                            };
                        })}
                    />
                )}
            </MerchantContentPanel>
        </MerchantPageShell>
    );
};

export default MerchantPriceBook;
