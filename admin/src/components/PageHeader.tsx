import React from "react";
import AdminGuideHint from "./AdminGuideHint";

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  extra,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div className="hz-page-title">
        <span className="hz-page-title__heading">{title}</span>
        {description ? (
          <AdminGuideHint
            className="hz-page-title__guide"
            summary="查看说明"
            description={description}
          />
        ) : null}
      </div>
      {extra}
    </div>
  );
};

export default PageHeader;
