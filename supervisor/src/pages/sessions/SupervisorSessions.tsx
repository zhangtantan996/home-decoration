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
import { MobileOutlined, LogoutOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../services/api";

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
    <div>
      <Card
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MobileOutlined />
            <span>登录设备管理</span>
            <Badge
              count={activeSessions.length}
              style={{ backgroundColor: "#52c41a" }}
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
                  strong
                  type="secondary"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  活跃会话 ({activeSessions.length})
                </Text>
                <List
                  dataSource={activeSessions}
                  renderItem={(session) => (
                    <List.Item
                      key={session.sessionId}
                      actions={[
                        <Popconfirm
                          key="revoke"
                          title={
                            session.isCurrent
                              ? "确定退出登录？"
                              : "确定踢出该设备？"
                          }
                          description={
                            session.isCurrent
                              ? "你将退出当前账号。"
                              : "该设备将被强制退出登录。"
                          }
                          onConfirm={() => handleRevoke(session.sessionId)}
                          okText="确定"
                          okButtonProps={{ danger: true }}
                          cancelText="取消"
                        >
                          <Button
                            size="small"
                            danger={!session.isCurrent}
                            type={session.isCurrent ? "default" : "text"}
                            icon={<LogoutOutlined />}
                            loading={revokingId === session.sessionId}
                          >
                            {session.isCurrent ? "退出登录" : "踢出"}
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <MobileOutlined
                            style={{ fontSize: 20, color: "#52c41a" }}
                          />
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Tag color="success">活跃</Tag>
                            {session.isCurrent && (
                              <Tag color="blue">当前设备</Tag>
                            )}
                            <Text
                              style={{ fontSize: 12, fontFamily: "monospace" }}
                            >
                              ID:{" "}
                              {session.deviceId
                                ? session.deviceId.slice(0, 8)
                                : session.sessionId.slice(0, 8)}
                              …
                            </Text>
                          </div>
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div style={{ marginBottom: 2 }}>
                              {session.deviceInfo || "未知设备"} · IP:{" "}
                              {session.ip || "未知"}
                            </div>
                            <Text type="secondary">
                              {session.lastUsedAt
                                ? `活跃于：${dayjs(session.lastUsedAt).format("YYYY-MM-DD HH:mm:ss")}`
                                : "会话信息不可用"}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </>
            )}

            {inactiveSessions.length > 0 && (
              <>
                <Text
                  strong
                  type="secondary"
                  style={{ display: "block", marginTop: 16, marginBottom: 8 }}
                >
                  已过期会话 ({inactiveSessions.length})
                </Text>
                <List
                  dataSource={inactiveSessions}
                  renderItem={(session) => (
                    <List.Item key={session.sessionId}>
                      <List.Item.Meta
                        avatar={
                          <MobileOutlined
                            style={{ fontSize: 20, color: "#d9d9d9" }}
                          />
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Tag>已过期</Tag>
                            <Text
                              type="secondary"
                              style={{ fontSize: 12, fontFamily: "monospace" }}
                            >
                              ID:{" "}
                              {session.deviceId
                                ? session.deviceId.slice(0, 8)
                                : session.sessionId.slice(0, 8)}
                              …
                            </Text>
                          </div>
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div style={{ marginBottom: 2 }}>
                              {session.deviceInfo || "未知设备"} · IP:{" "}
                              {session.ip || "未知"}
                            </div>
                            <Text type="secondary">
                              {session.lastUsedAt
                                ? `最后活动：${dayjs(session.lastUsedAt).format("YYYY-MM-DD HH:mm:ss")}`
                                : "—"}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
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
