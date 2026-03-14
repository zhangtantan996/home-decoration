import React from 'react';
import { Alert, List, Space, Tag, Typography } from 'antd';
import type { AdminAuditLegacyInfo, AdminAuditVisibility } from '../../../services/api';

const { Text } = Typography;

interface VisibilityStatusPanelProps {
    visibility?: AdminAuditVisibility;
    legacyInfo?: AdminAuditLegacyInfo;
}

const VisibilityStatusPanel: React.FC<VisibilityStatusPanelProps> = ({ visibility, legacyInfo }) => {
    if (!visibility) {
        return (
            <Alert
                showIcon
                type="info"
                message="可见性解释"
                description={<Text style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>暂无可见性数据</Text>}
            />
        );
    }

    const blockers = visibility.blockers || [];
    const preview = visibility.previewAfterApprove;

    return (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {visibility && (
                <Alert
                    showIcon
                    type={visibility.publicVisible ? 'success' : 'warning'}
                    message={`当前公开状态：${visibility.publicVisible ? '可见' : '不可见'}`}
                    description={
                        <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                            {visibility.currentLabel || '无'}
                        </div>
                    }
                />
            )}

            {blockers.length > 0 && (
                <List
                    size="small"
                    bordered
                    header="阻断项（完整）"
                    dataSource={blockers}
                    renderItem={(item) => (
                        <List.Item>
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                <Tag color="error">{item.code || 'unknown_blocker'}</Tag>
                                <Text style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.message}</Text>
                            </Space>
                        </List.Item>
                    )}
                />
            )}

            {preview && (
                <Alert
                    showIcon
                    type={preview.publicVisible ? 'info' : 'warning'}
                    message={`审核通过后：${preview.publicVisible ? '可见' : '不可见'}`}
                    description={
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Text style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{preview.message}</Text>
                            {preview.blockers.length > 0 && (
                                <List
                                    size="small"
                                    bordered
                                    header="通过后阻断项"
                                    dataSource={preview.blockers}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                                <Tag color="default">{item.code || 'unknown_blocker'}</Tag>
                                                <Text style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.message}</Text>
                                            </Space>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </Space>
                    }
                />
            )}

            {legacyInfo?.isLegacyPath && (
                <Alert
                    showIcon
                    type="warning"
                    message="Legacy / 非主链路"
                    description={
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            {(legacyInfo.notes || []).map((note, index) => (
                                <Text key={index} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                                    {note}
                                </Text>
                            ))}
                        </Space>
                    }
                />
            )}
        </Space>
    );
};

export default VisibilityStatusPanel;
