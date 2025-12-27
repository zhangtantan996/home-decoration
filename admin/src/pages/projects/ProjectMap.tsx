import React, { useEffect } from 'react';
import { Card, Empty } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

const ProjectMap: React.FC = () => {
    useEffect(() => {
        // 这里将来可以集成地图服务（高德地图/百度地图等）
        // 示例：加载项目坐标并在地图上标记
    }, []);

    return (
        <Card>
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '70vh',
                flexDirection: 'column',
                background: '#f5f5f5',
                borderRadius: 8
            }}>
                <Empty
                    image={<EnvironmentOutlined style={{ fontSize: 80, color: '#1890ff' }} />}
                    imageStyle={{ height: 100 }}
                    description={
                        <div>
                            <h3>全景地图功能</h3>
                            <p style={{ color: '#999' }}>
                                此功能需要集成第三方地图服务（如高德地图、百度地图）
                                <br />
                                可以展示所有项目的地理位置分布
                                <br />
                                支持项目筛选、聚合显示等功能
                            </p>
                        </div>
                    }
                />
            </div>
        </Card>
    );
};

export default ProjectMap;
