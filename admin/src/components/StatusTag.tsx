import React from 'react';
import { STATUS_CONFIG, type StatusKey } from '../constants/statusColors';

interface StatusTagProps {
  status: StatusKey;
  text?: string;
}

const StatusTag: React.FC<StatusTagProps> = ({ status, text }) => {
  const config = STATUS_CONFIG[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 6,
        fontSize: '0.78rem',
        fontWeight: 500,
        color: config.color,
        background: config.bg,
      }}
    >
      {text || config.text}
    </span>
  );
};

export default StatusTag;
