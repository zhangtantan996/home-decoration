import React from 'react';
import { Card } from 'antd';

interface AuditDetailSectionProps {
    title: string;
    children: React.ReactNode;
    extra?: React.ReactNode;
}

const AuditDetailSection: React.FC<AuditDetailSectionProps> = ({ title, children, extra }) => {
    return (
        <Card title={title} size="small" extra={extra} style={{ marginBottom: 12 }}>
            {children}
        </Card>
    );
};

export default AuditDetailSection;
