import { Tag } from "antd";
import { ACCOUNT_STATUS_META, LOGIN_STATUS_META } from "../constants/statuses";

export const resolveAccountStatusTag = (accountStatus?: string) => {
  const meta =
    ACCOUNT_STATUS_META[accountStatus || "unbound"] ||
    ACCOUNT_STATUS_META.unbound;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};

export const resolveLoginStatusTag = (loginStatus?: string) => {
  const meta =
    LOGIN_STATUS_META[loginStatus || "unbound"] || LOGIN_STATUS_META.unbound;
  return <Tag color={meta.color}>{meta.text}</Tag>;
};
