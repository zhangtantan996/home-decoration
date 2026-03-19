import React from 'react';
import { designTokens } from '../styles/theme';

type StatTone = 'accent' | 'success' | 'warning' | 'danger';

const gradientMap: Record<StatTone, string> = {
  accent: 'linear-gradient(135deg, #2563eb, #60a5fa)',
  success: 'linear-gradient(135deg, #059669, #34d399)',
  warning: 'linear-gradient(135deg, #d97706, #fbbf24)',
  danger: 'linear-gradient(135deg, #dc2626, #f87171)',
};

const trendColorMap: Record<StatTone, string> = {
  accent: designTokens.accent,
  success: designTokens.success,
  warning: designTokens.warning,
  danger: designTokens.danger,
};

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  trend?: string;
  footer?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  tone = 'accent',
  trend,
  footer,
}) => {
  return (
    <div className="hz-stat-card">
      <div className="hz-stat-card__bar" style={{ background: gradientMap[tone] }} />
      <div className="hz-stat-card__body">
        <div className="hz-stat-card__head">
          <div className="hz-stat-card__icon" data-tone={tone}>
            {icon}
          </div>
          {trend ? (
            <span className="hz-stat-card__trend" style={{ color: trendColorMap[tone] }}>
              {trend}
            </span>
          ) : null}
        </div>
        <div className="hz-stat-card__label">{title}</div>
        <div className="hz-stat-card__value">{value}</div>
        {footer ? <div className="hz-stat-card__footer">{footer}</div> : null}
      </div>
    </div>
  );
};

export default StatCard;
