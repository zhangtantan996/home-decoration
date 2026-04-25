import React from "react";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Popover } from "antd";

interface AdminGuideHintProps {
  summary: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

const AdminGuideHint: React.FC<AdminGuideHintProps> = ({
  summary,
  description,
  className,
}) => {
  const trigger = (
    <button
      type="button"
      className={`hz-guide-hint ${className || ""}`.trim()}
      aria-label="查看说明"
    >
      <InfoCircleOutlined className="hz-guide-hint__icon" />
      <span className="hz-guide-hint__summary">{summary}</span>
      {description ? (
        <span className="hz-guide-hint__meta">悬浮查看</span>
      ) : null}
    </button>
  );

  if (!description) {
    return trigger;
  }

  return (
    <Popover
      overlayClassName="hz-guide-hint-popover"
      placement="bottomLeft"
      trigger={["hover", "click"]}
      content={
        <div className="hz-guide-hint-popover__content">{description}</div>
      }
    >
      {trigger}
    </Popover>
  );
};

export default AdminGuideHint;
