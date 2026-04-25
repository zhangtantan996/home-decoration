import React from 'react';
import { Card, Empty, Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

interface PlaceholderPageProps {
    title: string;
    description?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
    return (
        <Card>
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                flexDirection: 'column'
            }}>
                <Empty
                    image={<ToolOutlined style={{ fontSize: 80, color: '#1890ff' }} />}
                    imageStyle={{ height: 100 }}
                    description={
                        <div>
                            <Title level={3}>{title}</Title>
                            <Paragraph type="secondary">
                                {description || '该入口暂未开放，请联系管理员确认开放范围。'}
                            </Paragraph>
                        </div>
                    }
                />
            </div>
        </Card>
    );
};

export default PlaceholderPage;
