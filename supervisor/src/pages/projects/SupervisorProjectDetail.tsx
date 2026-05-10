import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Typography,
  Spin,
  Tag,
  Descriptions,
  List,
  Button,
  Space,
  Empty,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Tabs,
  Drawer,
  Row,
  Col,
  Badge,
  Image,
  theme,
  Divider,
  Upload,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import type { RcFile, UploadFile, UploadProps } from "antd/es/upload/interface";
import {
  supervisorProjectApi,
  supervisorLogApi,
  supervisorPhaseApi,
  supervisorRiskApi,
  type SupervisionProjectWorkspace,
  type WorkLog,
  type ProjectPhaseView,
} from "../../services/supervisorApi";
import { dicts } from "../../utils/dict";
import { toAbsoluteAssetUrl } from "../../utils/env";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const iosCardStyle: React.CSSProperties = {
  borderRadius: 20,
  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
  border: "none",
};

// ─── main component ──────────────────────────────────────────────────────────

const SupervisorProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  const { token } = theme.useToken();

  // core data
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] =
    useState<SupervisionProjectWorkspace | null>(null);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [phases, setPhases] = useState<ProjectPhaseView[]>([]);
  const [phasesLoading, setPhasesLoading] = useState(false);
  const [activePhaseId, setActivePhaseId] = useState<number | null>(null);

  // Modals & Forms
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logImageList, setLogImageList] = useState<UploadFile[]>([]);
  const [logForm] = Form.useForm();

  const [phaseDrawerOpen, setPhaseDrawerOpen] = useState(false);
  const [phaseSubmitting, setPhaseSubmitting] = useState(false);
  const [phaseForm] = Form.useForm();

  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [riskSubmitting, setRiskSubmitting] = useState(false);
  const [riskForm] = Form.useForm();

  // ── load functions ──────────────────────────────────────────────────────

  const loadWorkspace = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    supervisorProjectApi
      .get(projectId)
      .then(setWorkspace)
      .catch(() => message.error("获取项目详情失败"))
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadLogs = useCallback(() => {
    if (!projectId) return;
    setLogsLoading(true);
    supervisorLogApi
      .list(projectId, { pageSize: 50 })
      .then((res) => {
        if (res.list) setLogs(res.list);
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [projectId]);

  const loadPhases = useCallback(() => {
    if (!projectId) return;
    setPhasesLoading(true);
    supervisorProjectApi
      .getPhases(projectId)
      .then((res) => {
        const list = res.phases ?? [];
        setPhases(list);
        if (list.length > 0 && !activePhaseId) {
          const inProgress = list.find((p) => p.status === "in_progress");
          setActivePhaseId((inProgress ?? list[0]).id);
        }
      })
      .catch(() => {})
      .finally(() => setPhasesLoading(false));
  }, [projectId, activePhaseId]);

  useEffect(() => {
    loadWorkspace();
    loadLogs();
    loadPhases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const openLogModal = () => {
    setLogImageList([]);
    logForm.resetFields();
    if (activePhaseId) logForm.setFieldValue("phaseId", activePhaseId);
    logForm.setFieldValue("photos", []);
    setLogModalOpen(true);
  };

  const activePhase = phases.find((p) => p.id === activePhaseId) ?? null;

  const openPhaseDrawer = () => {
    if (!activePhase) return;
    phaseForm.setFieldsValue({
      status: activePhase.status,
      responsiblePerson: activePhase.responsiblePerson,
      startDate: activePhase.startDate ? dayjs(activePhase.startDate) : null,
      endDate: activePhase.endDate ? dayjs(activePhase.endDate) : null,
    });
    setPhaseDrawerOpen(true);
  };

  const handleSavePhase = async () => {
    if (!activePhaseId) return;
    try {
      const values = await phaseForm.validateFields();
      setPhaseSubmitting(true);
      await supervisorPhaseApi.update(projectId, activePhaseId, {
        status: values.status,
        responsiblePerson: values.responsiblePerson,
        startDate: values.startDate
          ? dayjs(values.startDate).format("YYYY-MM-DD")
          : undefined,
        endDate: values.endDate
          ? dayjs(values.endDate).format("YYYY-MM-DD")
          : undefined,
      });
      message.success("阶段信息已更新");
      setPhaseDrawerOpen(false);
      loadPhases();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setPhaseSubmitting(false);
    }
  };

  const resetLogModal = () => {
    setLogModalOpen(false);
    setLogImageList([]);
    logForm.resetFields();
  };

  const uploadLogImage = async (
    file: RcFile,
  ): Promise<{ url?: string; path?: string }> => {
    return supervisorLogApi.uploadImage(file as File);
  };

  const handleLogImageUpload: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    try {
      const uploaded = await uploadLogImage(file as RcFile);
      const nextFile: UploadFile = {
        uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: (file as RcFile).name || "log-image",
        status: "done",
        url: uploaded.url,
        thumbUrl: uploaded.url,
        response: uploaded,
      };
      setLogImageList((prev) => [...prev, nextFile]);
      onSuccess?.(uploaded);
    } catch (error) {
      onError?.(error as Error);
      message.error(error instanceof Error ? error.message : "图片上传失败");
    }
  };

  const handleLogImageRemove = (file: UploadFile) => {
    setLogImageList((prev) => prev.filter((item) => item.uid !== file.uid));
  };

  const beforeLogImageUpload = (file: RcFile) => {
    const fileType = String(file.type || "").toLowerCase();
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(fileType)) {
      message.error("请上传 JPG/PNG/GIF/WEBP 图片");
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleCreateLog = async () => {
    try {
      const values = await logForm.validateFields();
      setLogSubmitting(true);
      const photoPaths = logImageList
        .map((file) =>
          String(
            (file.response as { path?: string } | undefined)?.path ||
              file.url ||
              "",
          ).trim(),
        )
        .filter(Boolean);
      await supervisorLogApi.create(projectId, Number(values.phaseId), {
        title: values.title,
        description: values.description,
        photos: JSON.stringify(photoPaths),
        logDate: values.logDate
          ? dayjs(values.logDate).format("YYYY-MM-DD")
          : undefined,
      });
      message.success("巡检日志已记录");
      resetLogModal();
      loadLogs();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setLogSubmitting(false);
    }
  };

  const handleReportRisk = async () => {
    try {
      const values = await riskForm.validateFields();
      setRiskSubmitting(true);
      await supervisorRiskApi.create(projectId, {
        type: values.type,
        level: values.level,
        description: values.description,
        phaseId: values.phaseId,
      });
      message.success("风险已上报");
      setRiskModalOpen(false);
      riskForm.resetFields();
      loadWorkspace();
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setRiskSubmitting(false);
    }
  };

  const safeParsePhotos = (photosStr: string | undefined): string[] => {
    if (!photosStr) return [];
    try {
      const parsed = JSON.parse(photosStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // ── render guards ───────────────────────────────────────────────────────

  if (loading) {
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
  if (!workspace) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", paddingBottom: 24 }}>
        <Card
          bordered={false}
          style={{ borderRadius: 16, textAlign: "center", padding: "60px 0" }}
        >
          <Empty description="项目不存在或无权访问" />
        </Card>
      </div>
    );
  }

  const cardStyle = { ...iosCardStyle, marginBottom: 24 };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        paddingBottom: 24,
        padding: "0 16px",
      }}
    >
      {/* 顶部操作栏 */}
      <div
        style={{
          marginBottom: 24,
          paddingTop: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/projects")}
          style={{ paddingLeft: 0, fontWeight: 500 }}
        >
          返回项目大厅
        </Button>
        <Button
          danger
          icon={<WarningOutlined />}
          onClick={() => {
            riskForm.resetFields();
            setRiskModalOpen(true);
          }}
          shape="round"
        >
          上报风险预警
        </Button>
      </div>

      {/* 核心看板 - Header */}
      <Card
        bordered={false}
        style={cardStyle}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: "32px 32px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <Title
                level={3}
                style={{ margin: "0 0 16px 0", fontWeight: 600 }}
              >
                {workspace.name}
              </Title>
              <Space
                size="large"
                wrap
                style={{ color: token.colorTextSecondary }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <EnvironmentOutlined /> {workspace.address}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <HomeOutlined /> {workspace.ownerName || "未知业主"}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <SafetyCertificateOutlined />{" "}
                  {workspace.providerName || "未指派服务商"}
                </span>
              </Space>
            </div>
            <div style={{ textAlign: "right" }}>
              <Text
                style={{
                  display: "block",
                  color: token.colorTextDescription,
                  marginBottom: 8,
                }}
              >
                当前项目状态
              </Text>
              <Tag
                color={dicts.phaseColor(workspace.currentPhaseStatus)}
                style={{
                  margin: 0,
                  borderRadius: 12,
                  padding: "4px 16px",
                  fontSize: 14,
                  border: "none",
                  fontWeight: 500,
                }}
              >
                {dicts.phaseType(workspace.currentPhase) || "未开工"}
              </Tag>
            </div>
          </div>
        </div>
        <Divider style={{ margin: 0 }} />
        <div
          style={{
            padding: "24px 32px",
            backgroundColor: "#fafafa",
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
          }}
        >
          <Row gutter={[32, 24]}>
            <Col xs={12} sm={6}>
              <Text
                style={{
                  display: "block",
                  color: token.colorTextDescription,
                  marginBottom: 4,
                }}
              >
                现场负责人
              </Text>
              <Text strong style={{ fontSize: 16 }}>
                {workspace.currentResponsible || "暂无"}
              </Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text
                style={{
                  display: "block",
                  color: token.colorTextDescription,
                  marginBottom: 4,
                }}
              >
                计划进场时间
              </Text>
              <Text strong style={{ fontSize: 16 }}>
                {workspace.plannedStartDate || "未定"}
              </Text>
            </Col>
            <Col xs={12} sm={6}>
              <Text
                style={{
                  display: "block",
                  color: token.colorTextDescription,
                  marginBottom: 4,
                }}
              >
                累计风险预警
              </Text>
              <Text
                strong
                style={{
                  fontSize: 16,
                  color:
                    workspace.unhandledRiskCount > 0
                      ? token.colorError
                      : token.colorSuccess,
                }}
              >
                {workspace.unhandledRiskCount} 项待处理
              </Text>
            </Col>
          </Row>
        </div>
      </Card>

      {/* 风险预警面板 (仅有风险时显示) */}
      {workspace.unhandledRiskCount > 0 && (
        <Card
          bordered={false}
          style={{ ...cardStyle, borderLeft: `4px solid ${token.colorError}` }}
        >
          <Title
            level={5}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: token.colorError,
              margin: "0 0 16px 0",
            }}
          >
            <ExclamationCircleOutlined /> 风险预警 (
            {workspace.unhandledRiskCount})
          </Title>
          <List
            dataSource={workspace.riskWarnings?.slice(0, 5)}
            renderItem={(warning) => (
              <List.Item style={{ padding: "12px 0", border: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    width: "100%",
                  }}
                >
                  <Tag
                    color={dicts.riskLevelColor(warning.level)}
                    style={{ borderRadius: 4, margin: 0 }}
                  >
                    {dicts.riskLevel(warning.level)}
                  </Tag>
                  <Tag style={{ borderRadius: 4, margin: 0 }}>
                    {dicts.riskType(warning.type)}
                  </Tag>
                  <Text style={{ flex: 1, color: token.colorTextHeading }}>
                    {warning.description}
                  </Text>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, flexShrink: 0 }}
                  >
                    {dayjs(warning.createdAt).format("MM-DD HH:mm")}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}

      <Row gutter={24}>
        {/* 左侧：施工阶段 & 控制台 */}
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 600 }}>阶段管控台</span>}
            bordered={false}
            style={cardStyle}
            extra={
              activePhase && (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<EditOutlined />}
                  onClick={openPhaseDrawer}
                  shape="round"
                >
                  更新当前阶段
                </Button>
              )
            }
          >
            {phasesLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : phases.length === 0 ? (
              <Empty description="暂无阶段数据" />
            ) : (
              <Tabs
                activeKey={String(activePhaseId)}
                onChange={(key) => setActivePhaseId(Number(key))}
                items={phases.map((phase) => ({
                  key: String(phase.id),
                  label: (
                    <Badge
                      dot={phase.status === "in_progress"}
                      color={
                        dicts.phaseColor(phase.status) === "processing"
                          ? token.colorPrimary
                          : undefined
                      }
                    >
                      <span style={{ fontWeight: 500 }}>
                        {phase.name || dicts.phaseType(phase.phaseType)}
                      </span>
                    </Badge>
                  ),
                  children: (
                    <div style={{ padding: "16px 0 0 0" }}>
                      <Descriptions
                        column={{ xs: 1, sm: 2 }}
                        size="middle"
                        layout="vertical"
                        colon={false}
                      >
                        <Descriptions.Item
                          label={<Text type="secondary">当前状态</Text>}
                        >
                          <Tag
                            color={dicts.phaseColor(phase.status)}
                            style={{ borderRadius: 12, padding: "2px 12px" }}
                          >
                            {dicts.phaseStatus(phase.status)}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={<Text type="secondary">指派责任人</Text>}
                        >
                          {phase.responsiblePerson || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={<Text type="secondary">计划开始时间</Text>}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ScheduleOutlined /> {phase.startDate || "-"}
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item
                          label={<Text type="secondary">计划完成时间</Text>}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <ClockCircleOutlined /> {phase.endDate || "-"}
                          </span>
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>

        {/* 右侧：施工日志追踪 */}
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ fontWeight: 600 }}>现场巡检日志</span>}
            bordered={false}
            style={{ ...cardStyle, height: "100%" }}
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openLogModal}
                shape="round"
              >
                记录巡检
              </Button>
            }
          >
            {logsLoading ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <Spin />
              </div>
            ) : logs.length === 0 ? (
              <Empty
                description={<Text type="secondary">暂无巡检记录</Text>}
                style={{ padding: "40px 0" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  marginTop: 16,
                }}
              >
                {logs.map((log) => {
                  const photos = safeParsePhotos(log.photos);
                  return (
                    <Card
                      key={log.id}
                      size="small"
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${token.colorSplit}40`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "8px 4px",
                        }}
                      >
                        <CheckCircleOutlined
                          style={{
                            fontSize: "20px",
                            color: token.colorSuccess,
                            marginTop: 2,
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <Text strong style={{ fontSize: 16 }}>
                              {log.title}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              {log.logDate}
                            </Text>
                          </div>
                          <Paragraph
                            style={{
                              color: token.colorTextSecondary,
                              fontSize: 14,
                              marginBottom: 12,
                              lineHeight: 1.6,
                            }}
                          >
                            {log.description}
                          </Paragraph>
                          {photos.length > 0 && (
                            <Image.PreviewGroup>
                              <Space size={8} wrap>
                                {photos.map((url, idx) => (
                                  <Image
                                    key={idx}
                                    src={toAbsoluteAssetUrl(url)}
                                    width={90}
                                    height={90}
                                    style={{
                                      borderRadius: 8,
                                      objectFit: "cover",
                                    }}
                                  />
                                ))}
                              </Space>
                            </Image.PreviewGroup>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Modal: 创建日志 ── */}
      <Modal
        title={<span style={{ fontWeight: 600 }}>新增现场巡检日志</span>}
        open={logModalOpen}
        onOk={handleCreateLog}
        onCancel={resetLogModal}
        confirmLoading={logSubmitting}
        okText="确认提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={logForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="phaseId"
            label="关联当前阶段"
            rules={[{ required: true, message: "请选择施工阶段" }]}
          >
            <Select
              placeholder="选择所属阶段"
              size="large"
              options={phases.map((p) => ({
                label: p.name || p.phaseType,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="简明标题"
            rules={[
              { required: true, message: "请输入标题" },
              { max: 100, message: "标题不超过100字" },
            ]}
          >
            <Input
              placeholder="例如：水电线路阶段性巡检"
              size="large"
              maxLength={100}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="现场情况描述"
            rules={[{ required: true, message: "请输入详细描述" }]}
          >
            <TextArea
              rows={4}
              placeholder="客观记录发现的问题、施工质量和下一步建议..."
              maxLength={2000}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="photos"
            label="现场照片"
            valuePropName="fileList"
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) return e;
              return e?.fileList;
            }}
            rules={[
              { required: true, message: "请上传至少两张现场照片" },
              {
                validator: async (_, fileList) => {
                  if (!fileList || fileList.length < 2) {
                    return Promise.reject(new Error("请上传至少两张现场照片"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Upload
              listType="picture-card"
              maxCount={9}
              fileList={logImageList}
              customRequest={handleLogImageUpload}
              onRemove={handleLogImageRemove}
              beforeUpload={beforeLogImageUpload}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传照片</div>
              </div>
            </Upload>
          </Form.Item>
          <Form.Item name="logDate" label="巡检日期">
            <DatePicker
              style={{ width: "100%" }}
              size="large"
              placeholder="默认为今日"
              disabledDate={(d) => d && d.isAfter(dayjs(), "day")}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer: 编辑阶段 ── */}
      <Drawer
        title={
          <span style={{ fontWeight: 600 }}>
            阶段管控：{activePhase?.name || activePhase?.phaseType || ""}
          </span>
        }
        open={phaseDrawerOpen}
        onClose={() => setPhaseDrawerOpen(false)}
        width={400}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <Button onClick={() => setPhaseDrawerOpen(false)} shape="round">
              取消
            </Button>
            <Button
              type="primary"
              loading={phaseSubmitting}
              onClick={handleSavePhase}
              shape="round"
            >
              保存更新
            </Button>
          </div>
        }
      >
        <Form form={phaseForm} layout="vertical" size="large">
          <Form.Item name="status" label="阶段状态">
            <Select
              options={[
                { label: "待开始", value: "pending" },
                { label: "进行中", value: "in_progress" },
                { label: "已完成", value: "completed" },
                { label: "暂停", value: "paused" },
              ]}
            />
          </Form.Item>
          <Form.Item name="responsiblePerson" label="责任人">
            <Input
              placeholder="输入项目负责人姓名"
              prefix={<UserOutlined style={{ color: "#bfbfbf" }} />}
            />
          </Form.Item>
          <Form.Item name="startDate" label="计划开始时间">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="endDate" label="计划完成时间">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ── Modal: 上报风险 ── */}
      <Modal
        title={
          <>
            <WarningOutlined style={{ color: "#ff4d4f" }} /> 上报异常/风险
          </>
        }
        open={riskModalOpen}
        onOk={handleReportRisk}
        onCancel={() => {
          setRiskModalOpen(false);
          riskForm.resetFields();
        }}
        confirmLoading={riskSubmitting}
        okText="确认警报"
        okButtonProps={{ danger: true, shape: "round" }}
        cancelButtonProps={{ shape: "round" }}
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={riskForm}
          layout="vertical"
          style={{ marginTop: 24 }}
          size="large"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="异常类型"
                rules={[{ required: true, message: "请选择类型" }]}
              >
                <Select
                  placeholder="分类"
                  options={[
                    "delay",
                    "quality",
                    "payment",
                    "dispute",
                    "safety",
                    "other",
                  ].map((v) => ({ label: dicts.riskType(v), value: v }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="level"
                label="严重程度"
                rules={[{ required: true, message: "请选择等级" }]}
              >
                <Select
                  placeholder="定级"
                  options={["low", "medium", "high", "critical"].map((v) => ({
                    label: dicts.riskLevel(v),
                    value: v,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="phaseId" label="关联阶段">
            <Select
              placeholder="选择关联阶段（选填）"
              allowClear
              options={phases.map((p) => ({
                label: p.name || p.phaseType,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="异常情况详述"
            rules={[{ required: true, message: "请描述详情" }]}
          >
            <TextArea
              rows={4}
              placeholder="描述问题的具体表现、产生影响和建议..."
              maxLength={1000}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupervisorProjectDetail;
