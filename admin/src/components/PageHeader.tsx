import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, extra }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div className="hz-page-title">
        <span className="hz-page-title__heading">{title}</span>
        {description ? <span className="hz-page-title__meta">{description}</span> : null}
      </div>
      {extra}
    </div>
  );
};

export default PageHeader;
