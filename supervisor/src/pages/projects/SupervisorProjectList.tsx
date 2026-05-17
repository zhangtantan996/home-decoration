import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  Tag,
  Input,
  Spin,
  Empty,
  Row,
  Col,
  Typography,
  Badge,
  Pagination,
  theme,
} from "antd";
import { SearchOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  supervisorProjectApi,
  type SupervisionProjectListItem,
} from "../../services/supervisorApi";
import { dicts } from "../../utils/dict";
import { SUPERVISOR_THEME } from "../../constants/supervisorTheme";

const { Search } = Input;
const { Title, Text } = Typography;

const iosCardStyle: React.CSSProperties = {
  borderRadius: SUPERVISOR_THEME.cardRadius,
  boxShadow: SUPERVISOR_THEME.subtleShadow,
  border: `1px solid ${SUPERVISOR_THEME.borderColor}`,
  transition: "all 180ms ease-out",
};

const SupervisorProjectList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<SupervisionProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const fetchProjects = useCallback(
    (kw?: string, p?: number) => {
      setLoading(true);
      supervisorProjectApi
        .list({ keyword: kw || keyword, page: p || page, pageSize: 12 })
        .then((res) => {
          if (res.list) {
            setProjects(res.list);
            setTotal(res.total);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [keyword, page],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
    fetchProjects(value, 1);
  };

  return (
    <div className="supervisor-page">
      {/* Header & Search */}
      <div
        style={{
          marginBottom: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          padding: "0 8px",
        }}
      >
        <div>
          <Title
            level={2}
            style={{
              fontWeight: 600,
              color: token.colorTextHeading,
              margin: 0,
            }}
          >
            项目大厅
          </Title>
          <Text style={{ color: token.colorTextSecondary, fontSize: 16 }}>
            全面掌控所有监控项的实施进度
          </Text>
        </div>
        <Search
          placeholder="搜索项目名称、地址、业主..."
          allowClear
          size="large"
          enterButton={
            <>
              <SearchOutlined /> 搜索
            </>
          }
          onSearch={handleSearch}
          style={{ width: "100%", maxWidth: 400 }}
        />
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <Spin size="large" />
        </div>
      ) : projects.length === 0 ? (
        <Card
          className="supervisor-panel"
          style={{ ...iosCardStyle, textAlign: "center", padding: "60px 0" }}
        >
          <Empty
            description={
              <Text style={{ color: token.colorTextSecondary, fontSize: 15 }}>
                未找到符合条件的项目
              </Text>
            }
          />
        </Card>
      ) : (
        <>
          <Row gutter={[24, 24]}>
            {projects.map((item) => (
              <Col xs={24} md={12} xl={8} key={item.id}>
                <Card
                  className="supervisor-lift-card"
                  onClick={() => navigate(`/projects/${item.id}`)}
                  style={{
                    ...iosCardStyle,
                    overflow: "hidden",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                  }}
                  styles={{
                    body: {
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                    },
                  }}
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
                          flex: 1,
                          paddingRight: 12,
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
                          whiteSpace: "nowrap",
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
                      backgroundColor: SUPERVISOR_THEME.surfaceMuted,
                      display: "flex",
                      gap: 16,
                      flex: 1,
                      alignItems: "flex-end",
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
                          fontSize: 14,
                          fontWeight: 500,
                          color: token.colorTextHeading,
                        }}
                        ellipsis
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
                          fontSize: 14,
                          fontWeight: 500,
                          color: token.colorTextHeading,
                        }}
                        ellipsis
                      >
                        {item.ownerName || "未知"}
                      </Text>
                    </div>
                    <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                      <Text
                        style={{
                          fontSize: 13,
                          color: token.colorTextDescription,
                          display: "block",
                          marginBottom: 6,
                        }}
                      >
                        风险项
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

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 32,
            }}
          >
            <Pagination
              current={page}
              total={total}
              pageSize={12}
              onChange={(p) => {
                setPage(p);
                fetchProjects(keyword, p);
              }}
              showTotal={(t) => `共 ${t} 个项目`}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default SupervisorProjectList;
