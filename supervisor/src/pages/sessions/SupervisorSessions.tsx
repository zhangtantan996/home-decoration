import React, { useEffect, useState } from "react";
import {
  Card,
  List,
  Tag,
  Button,
  Spin,
  Empty,
  Typography,
  Popconfirm,
  message,
  Result,
  Badge,
} from "antd";
import {
  ClockCircleOutlined,
  LogoutOutlined,
  MobileOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../services/api";
import { SUPERVISOR_THEME } from "../../constants/supervisorTheme";

const { Text } = Typography;

interface SessionInfo {
  sessionId: string;
  active: boolean;
  isCurrent?: boolean;
  createdAt?: string;
  lastUsedAt?: string;
  deviceInfo?: string;
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

interface SessionListPayload {
  sessions?: SessionInfo[];
  total?: number;
}

const resolveSessionId = (session: SessionInfo): string =>
  session.deviceId || session.sessionId;

const formatShortId = (session: SessionInfo): string => {
  const id = resolveSessionId(session);
  return id.length > 12 ? `${id.slice(0, 8)}...` : id;
};

const formatSessionTime = (value?: string): string =>
  value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "暂无记录";

const renderSessionItem = (
  session: SessionInfo,
  options: {
    inactive?: boolean;
    revokingId?: string | null;
    onRevoke?: (sid: string) => void;
  },
) => {
  const isInactive = Boolean(options.inactive);
  const sessionId = resolveSessionId(session);
  const deviceName =
    session.deviceInfo || (isInactive ? "历史登录设备" : "当前登录设备");
  const timeLabel = isInactive ? "最后活动" : "活跃于";
  const iconColor = isInactive
    ? SUPERVISOR_THEME.textMuted
    : SUPERVISOR_THEME.successColor;

  return (
    <List.Item className="supervisor-session-item" key={session.sessionId}>
      <div className="supervisor-session-card">
        <div className="supervisor-session-main">
          <div
            className={
              isInactive
                ? "supervisor-session-icon supervisor-session-icon-muted"
                : "supervisor-session-icon"
            }
          >
            <MobileOutlined style={{ color: iconColor }} />
          </div>

          <div className="supervisor-session-content">
            <div className="supervisor-session-topline">
              <div className="supervisor-session-tags">
                <Tag color={isInactive ? "default" : "success"}>
                  {isInactive ? "已过期" : "活跃"}
                </Tag>
                {session.isCurrent && <Tag color="blue">当前设备</Tag>}
              </div>
              <Text
                className="supervisor-session-id"
                type="secondary"
                title={sessionId}
              >
                ID: {formatShortId(session)}
              </Text>
            </div>

            <Text className="supervisor-session-device" strong>
              {deviceName}
            </Text>

            <div className="supervisor-session-meta">
              <span className="supervisor-session-ip">
                IP: {session.ip || "未知"}
              </span>
              <span className="supervisor-session-time">
                <ClockCircleOutlined className="supervisor-session-time-icon" />
                <span className="supervisor-session-time-text">
                  {timeLabel}: {formatSessionTime(session.lastUsedAt)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {!isInactive && options.onRevoke && (
          <Popconfirm
            title={session.isCurrent ? "确定退出登录？" : "确定踢出该设备？"}
            description={
              session.isCurrent
                ? "你将退出当前账号。"
                : "该设备将被强制退出登录。"
            }
            onConfirm={() => options.onRevoke?.(session.sessionId)}
            okText="确定"
            okButtonProps={{ danger: true }}
            cancelText="取消"
          >
            <Button
              className="supervisor-session-action"
              size="small"
              danger={!session.isCurrent}
              type={session.isCurrent ? "default" : "text"}
              icon={<LogoutOutlined />}
              loading={options.revokingId === session.sessionId}
            >
              {session.isCurrent ? "退出登录" : "踢出"}
            </Button>
          </Popconfirm>
        )}
      </div>
    </List.Item>
  );
};

const SupervisorSessions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadSessions = () => {
    setLoading(true);
    (
      api.get("/supervisor/sessions") as Promise<{
        code?: number;
        message?: string;
        data?: SessionListPayload;
      }>
    )
      .then((res) => setSessions(res.data?.sessions ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sid: string) => {
    setRevokingId(sid);
    try {
      await api.post(`/supervisor/sessions/${sid}/revoke`);
      message.success("设备已踢出");
      loadSessions();
    } catch {
      message.error("操作失败，请重试");
    } finally {
      setRevokingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="获取会话失败"
        subTitle="请刷新页面重试。"
        extra={<Button onClick={loadSessions}>重试</Button>}
      />
    );
  }

  const activeSessions = sessions.filter((s) => s.active);
  const inactiveSessions = sessions.filter((s) => !s.active);

  return (
    <div className="supervisor-page supervisor-sessions-page">
      <Card
        className="supervisor-panel"
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MobileOutlined />
            <span>登录设备管理</span>
            <Badge
              count={activeSessions.length}
              style={{ backgroundColor: SUPERVISOR_THEME.successColor }}
            />
          </div>
        }
      >
        {sessions.length === 0 ? (
          <Empty description="暂无登录会话" />
        ) : (
          <>
            {activeSessions.length > 0 && (
              <>
                <Text
                  className="supervisor-session-section-title"
                  strong
                  type="secondary"
                >
                  活跃会话 ({activeSessions.length})
                </Text>
                <List
                  className="supervisor-session-list"
                  dataSource={activeSessions}
                  renderItem={(session) =>
                    renderSessionItem(session, {
                      revokingId,
                      onRevoke: handleRevoke,
                    })
                  }
                />
              </>
            )}

            {inactiveSessions.length > 0 && (
              <>
                <Text
                  className="supervisor-session-section-title supervisor-session-section-title-spaced"
                  strong
                  type="secondary"
                >
                  已过期会话 ({inactiveSessions.length})
                </Text>
                <List
                  className="supervisor-session-list"
                  dataSource={inactiveSessions}
                  renderItem={(session) =>
                    renderSessionItem(session, { inactive: true })
                  }
                />
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default SupervisorSessions;
