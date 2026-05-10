import React, { useEffect } from "react";
import {
  Card,
  Typography,
  Spin,
  Tag,
  Empty,
  Row,
  Col,
  Statistic,
  Badge,
  theme,
} from "antd";
import {
  ProjectOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSupervisorAuthStore } from "../../stores/supervisorAuthStore";
import { useDashboardStore } from "../../stores/dashboardStore";
import { dicts } from "../../utils/dict";

const { Title, Text } = Typography;

const iosCardStyle: React.CSSProperties = {
  borderRadius: 20,
  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
  border: "none",
  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
};

const iosHoverStyle = `
    .ios-hover-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 14px 40px rgba(0,0,0,0.08) !important;
    }
`;

const SupervisorDashboard: React.FC = () => {
  const { totalProjects, recentProjects, loading, fetch } = useDashboardStore();
  const supervisor = useSupervisorAuthStore((s) => s.supervisor);
  const navigate = useNavigate();
  const { token } = theme.useToken();

  useEffect(() => {
    // fetch() 内部有缓存检查：5 分钟内不重复请求
    void fetch();
  }, [fetch]);

  // 有缓存数据时不显示全屏 loading，直接渲染旧数据
  if (loading && recentProjects.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "60vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const unhandledRisks = recentProjects.reduce(
    (acc, p) => acc + (p.unhandledRiskCount || 0),
    0,
  );
  const completedProjects = recentProjects.filter(
    (p) => p.businessStage === "completed",
  ).length;

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        paddingBottom: 24,
        padding: "0 16px",
      }}
    >
      <style>{iosHoverStyle}</style>

      {/* Header Section */}
      <div style={{ marginBottom: 32, padding: "0 8px" }}>
        <Title
          level={2}
          style={{
            fontWeight: 600,
            color: token.colorTextHeading,
            marginBottom: 8,
            letterSpacing: "-0.5px",
          }}
        >
          欢迎回来，{supervisor?.realName || "监理工程师"}
        </Title>
        <Text style={{ color: token.colorTextSecondary, fontSize: 16 }}>
          这是您今日的专属监控简报。保持专业，守护品质。
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <Card
            className="ios-hover-card"
            style={{ ...iosCardStyle, padding: "8px 4px" }}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <Statistic
              title={
                <Text style={{ color: token.colorTextSecondary, fontSize: 14 }}>
                  在建项目总数
                </Text>
              }
              value={totalProjects}
              prefix={
                <ProjectOutlined
                  style={{ color: token.colorPrimary, marginRight: 8 }}
                />
              }
              valueStyle={{
                fontWeight: 600,
                fontSize: 36,
                color: token.colorTextHeading,
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            className="ios-hover-card"
            style={{ ...iosCardStyle, padding: "8px 4px" }}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <Statistic
              title={
                <Text style={{ color: token.colorTextSecondary, fontSize: 14 }}>
                  待处理风险
                </Text>
              }
              value={unhandledRisks}
              prefix={
                <AlertOutlined
                  style={{
                    color:
                      unhandledRisks > 0
                        ? token.colorError
                        : token.colorSuccess,
                    marginRight: 8,
                  }}
                />
              }
              valueStyle={{
                fontWeight: 600,
                fontSize: 36,
                color:
                  unhandledRisks > 0
                    ? token.colorError
                    : token.colorTextHeading,
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            className="ios-hover-card"
            style={{ ...iosCardStyle, padding: "8px 4px" }}
            styles={{ body: { padding: "20px 24px" } }}
          >
            <Statistic
              title={
                <Text style={{ color: token.colorTextSecondary, fontSize: 14 }}>
                  已竣工项目
                </Text>
              }
              value={completedProjects}
              prefix={
                <CheckCircleOutlined
                  style={{ color: token.colorSuccess, marginRight: 8 }}
                />
              }
              valueStyle={{
                fontWeight: 600,
                fontSize: 36,
                color: token.colorTextHeading,
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Projects Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          padding: "0 8px",
        }}
      >
        <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
          活跃项目监控
        </Title>
        <Text
          style={{
            color: token.colorPrimary,
            cursor: "pointer",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
          onClick={() => navigate("/projects")}
        >
          查看全部 <RightOutlined style={{ fontSize: 12 }} />
        </Text>
      </div>

      {recentProjects.length === 0 ? (
        <Card
          style={{ ...iosCardStyle, textAlign: "center", padding: "60px 0" }}
        >
          <Empty
            description={
              <Text style={{ color: token.colorTextSecondary, fontSize: 15 }}>
                暂无分配的项目
              </Text>
            }
          />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {recentProjects.map((item) => (
            <Col xs={24} lg={12} key={item.id}>
              <Card
                className="ios-hover-card"
                onClick={() => navigate(`/projects/${item.id}`)}
                style={{
                  ...iosCardStyle,
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                styles={{ body: { padding: 0 } }}
              >
                {/* Project Header */}
                <div
                  style={{
                    padding: "24px 28px",
                    borderBottom: `1px solid ${token.colorSplit}40`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Title
                      level={5}
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        fontSize: 18,
                        color: token.colorTextHeading,
                      }}
                      ellipsis
                    >
                      {item.name}
                    </Title>
                    <Tag
                      color={dicts.phaseColor(item.currentPhaseStatus)}
                      style={{
                        margin: 0,
                        borderRadius: 12,
                        padding: "4px 14px",
                        border: "none",
                        fontWeight: 500,
                      }}
                    >
                      {dicts.phaseType(item.currentPhase) || "未开工"}
                    </Tag>
                  </div>
                  <Text
                    style={{
                      color: token.colorTextSecondary,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <SafetyCertificateOutlined /> {item.address}
                  </Text>
                </div>

                {/* Project Details & Status */}
                <div
                  style={{
                    padding: "20px 28px",
                    backgroundColor: "rgba(0,0,0,0.015)",
                    display: "flex",
                    gap: 24,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: token.colorTextDescription,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      服务商
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: token.colorTextHeading,
                      }}
                    >
                      {item.providerName || "未分配"}
                    </Text>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: token.colorTextDescription,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      业主
                    </Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: token.colorTextHeading,
                      }}
                    >
                      {item.ownerName || "未知"}
                    </Text>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: token.colorTextDescription,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      当前风险
                    </Text>
                    {item.unhandledRiskCount > 0 ? (
                      <Badge
                        count={`${item.unhandledRiskCount} 项`}
                        color={token.colorError}
                        style={{ boxShadow: "none" }}
                      />
                    ) : (
                      <Text
                        style={{
                          fontSize: 15,
                          color: token.colorSuccess,
                          fontWeight: 600,
                        }}
                      >
                        无异常
                      </Text>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default SupervisorDashboard;
