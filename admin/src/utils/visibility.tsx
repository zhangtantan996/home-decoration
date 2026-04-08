import React from "react";
import { Space, Tag, Tooltip, Typography } from "antd";
import type {
  AdminAuditLegacyInfo,
  AdminAuditVisibility,
} from "../services/api";
import {
  DISTRIBUTION_STATUS_META,
  LEGACY_PATH_BADGE,
} from "../constants/statuses";

const { Text } = Typography;

const fallbackDistributionStatus = (
  visibility?: AdminAuditVisibility,
): string => {
  if (visibility?.distributionStatus) {
    return visibility.distributionStatus;
  }
  if (visibility?.publicVisible) {
    return "active";
  }
  return "blocked_by_qualification";
};

export const getVisibilityStatusMeta = (visibility?: AdminAuditVisibility) =>
  DISTRIBUTION_STATUS_META[fallbackDistributionStatus(visibility)] ||
  DISTRIBUTION_STATUS_META.blocked_by_qualification;

export const getVisibilitySummaryText = (visibility?: AdminAuditVisibility) => {
  if (!visibility) {
    return "-";
  }
  if (visibility.primaryBlockerMessage) {
    return visibility.primaryBlockerMessage;
  }
  const blockers = visibility.blockers || [];
  if (blockers.length === 0) {
    return visibility.publicVisible ? "当前公开正常" : "暂无阻断说明";
  }
  const first = blockers[0]?.message || "-";
  return blockers.length > 1 ? `${first} + ${blockers.length - 1} 条` : first;
};

export const renderVisibilityTag = (
  visibility?: AdminAuditVisibility,
  legacyInfo?: AdminAuditLegacyInfo,
) => {
  const meta = getVisibilityStatusMeta(visibility);
  return (
    <Space size={4} wrap>
      <Tag color={meta.color}>{meta.text}</Tag>
      {legacyInfo?.isLegacyPath && (
        <Tag color={LEGACY_PATH_BADGE.color}>{LEGACY_PATH_BADGE.text}</Tag>
      )}
    </Space>
  );
};

export const renderVisibilitySummary = (
  visibility?: AdminAuditVisibility,
  legacyInfo?: AdminAuditLegacyInfo,
) => {
  const summary = getVisibilitySummaryText(visibility);
  const blockers = visibility?.blockers || [];

  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      {renderVisibilityTag(visibility, legacyInfo)}
      <Tooltip
        title={
          blockers.length > 0 ? (
            <div style={{ maxWidth: 360 }}>
              {blockers.map((item) => (
                <div
                  key={item.code || item.message}
                  style={{ marginBottom: 4, whiteSpace: "normal" }}
                >
                  {item.message}
                </div>
              ))}
            </div>
          ) : null
        }
      >
        <Text ellipsis style={{ display: "inline-block", maxWidth: 260 }}>
          {summary}
        </Text>
      </Tooltip>
    </Space>
  );
};
