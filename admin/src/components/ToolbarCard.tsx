import React from 'react';
import { Card } from 'antd';

interface ToolbarCardProps {
  children: React.ReactNode;
}

const ToolbarCard: React.FC<ToolbarCardProps> = ({ children }) => {
  return <Card className="hz-toolbar-card">{children}</Card>;
};

export default ToolbarCard;
