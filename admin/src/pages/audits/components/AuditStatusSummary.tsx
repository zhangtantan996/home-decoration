import React from 'react';
import { Alert, Space, Tag, Typography } from 'antd';
import type { AdminAuditLegacyInfo, AdminAuditVisibility } from '../../../services/api';

const { Text } = Typography;

interface AuditStatusSummaryProps {
    visibility?: AdminAuditVisibility;
    rejectResubmittable?: boolean;
    legacyInfo?: AdminAuditLegacyInfo;
}

const AuditStatusSummary: React.FC<AuditStatusSummaryProps> = ({
    visibility,
    rejectResubmittable,
    legacyInfo,
}) => {
    if (!visibility && rejectResubmittable == null && !legacyInfo) {
        return null;
    }

    const blockerCount = visibility?.blockers?.length ?? 0;
    const preview = visibility?.previewAfterApprove;

    return (
        <Alert
            type="info"
            showIcon
            message={
                <Space wrap size={8}>
                    {visibility && (
                        <>
                            <Tag color={visibility.publicVisible ? 'success' : 'warning'}>
                                当前公开：{visibility.publicVisible ? '可见' : '不可见'}
                            </Tag>
                            <Tag color={blockerCount > 0 ? 'error' : 'default'}>
                                阻断项：{blockerCount}
                            </Tag>
                            {preview && (
                                <Tag color={preview.publicVisible ? 'processing' : 'default'}>
                                    通过后：{preview.publicVisible ? '可见' : '不可见'}
                                </Tag>
                            )}
                        </>
                    )}
                    {rejectResubmittable != null && (
                        <Tag color={rejectResubmittable ? 'blue' : 'default'}>
                            驳回后可重提：{rejectResubmittable ? '是' : '否'}
                        </Tag>
                    )}
                    {legacyInfo?.isLegacyPath && <Tag color="gold">Legacy 路径</Tag>}
                </Space>
            }
            description={
                visibility?.currentLabel ? (
                    <Text type="secondary">状态标签：{visibility.currentLabel}</Text>
                ) : undefined
            }
        />
    );
};

export default AuditStatusSummary;
