import React, { useState } from 'react';
import { Card, Button, Space } from 'antd';
import { UpOutlined, DownOutlined } from '@ant-design/icons';

interface AuditDetailSectionProps {
    title: string;
    children: React.ReactNode;
    extra?: React.ReactNode;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
}

const AuditDetailSection: React.FC<AuditDetailSectionProps> = ({
    title,
    children,
    extra,
    collapsible = false,
    defaultCollapsed = false
}) => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    return (
        <Card
            title={title}
            size="small"
            extra={
                <Space>
                    {extra}
                    {collapsible && (
                        <Button
                            type="link"
                            size="small"
                            onClick={() => setCollapsed(!collapsed)}
                            icon={collapsed ? <DownOutlined /> : <UpOutlined />}
                        >
                            {collapsed ? '展开' : '收起'}
                        </Button>
                    )}
                </Space>
            }
            style={{ marginBottom: 12 }}
            styles={collapsible && collapsed ? { body: { display: 'none' } } : undefined}
        >
            {children}
        </Card>
    );
};

export default AuditDetailSection;
