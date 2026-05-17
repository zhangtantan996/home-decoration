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
  Row,
  Col,
  Badge,
  Tooltip,
  Image,
  theme,
  Divider,
  Upload,
  Radio,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  EditOutlined,
  SafetyCertificateOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
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
import { SUPERVISOR_THEME } from "../../constants/supervisorTheme";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const MAX_LOG_PHOTOS = 9;
type PhaseAction = "start" | "complete" | "pause" | "resume";

const phaseActionMeta: Record<
  PhaseAction,
  { label: string; targetStatus: "in_progress" | "completed" | "paused" }
> = {
  start: { label: "开始阶段", targetStatus: "in_progress" },
  complete: { label: "完成阶段", targetStatus: "completed" },
  pause: { label: "暂停阶段", targetStatus: "paused" },
  resume: { label: "恢复进行", targetStatus: "in_progress" },
};

const iosCardStyle: React.CSSProperties = {
  borderRadius: SUPERVISOR_THEME.cardRadius,
  boxShadow: SUPERVISOR_THEME.subtleShadow,
  border: `1px solid ${SUPERVISOR_THEME.borderColor}`,
};

const getPhaseActions = (status: string): PhaseAction[] => {
  switch (status) {
    case "pending":
      return ["start"];
    case "in_progress":
      return ["complete", "pause"];
    case "paused":
      return ["resume"];
    default:
      return [];
  }
};

const toValidDay = (value?: string | null): Dayjs | null => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.startOf("day") : null;
};

const latestDay = (...days: Array<Dayjs | null | undefined>): Dayjs | null => {
  return days.reduce<Dayjs | null>((latest, day) => {
    if (!day) return latest;
    return !latest || day.isAfter(latest) ? day : latest;
  }, null);
};

const findCurrentPhaseCandidate = (
  list: ProjectPhaseView[],
  currentPhaseLabel?: string,
): ProjectPhaseView | null => {
  const normalizedLabel = String(currentPhaseLabel || "").trim();
  if (normalizedLabel) {
    const matched = list.find(
      (phase) =>
        phase.phaseType === normalizedLabel ||
        phase.name === normalizedLabel ||
        dicts.phaseType(phase.phaseType) === normalizedLabel,
    );
    if (matched) return matched;
  }
  return (
    list.find((phase) => phase.status === "in_progress") ??
    list.find((phase) => phase.status === "paused") ??
    list.find((phase) => phase.status === "pending") ??
    list[list.length - 1] ??
    null
  );
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

  const [phaseActionModalOpen, setPhaseActionModalOpen] = useState(false);
  const [phaseSubmitting, setPhaseSubmitting] = useState(false);
  const [phaseForm] = Form.useForm();
  const selectedPhaseAction = Form.useWatch("action", phaseForm) as
    | PhaseAction
    | undefined;

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
    if (!projectId || !activePhaseId) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    supervisorLogApi
      .list(projectId, { pageSize: 50, phaseId: activePhaseId })
      .then((res) => {
        if (res.list) setLogs(res.list);
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [projectId, activePhaseId]);

  const loadPhases = useCallback(() => {
    if (!projectId) return;
    setPhasesLoading(true);
    supervisorProjectApi
      .getPhases(projectId)
      .then((res) => {
        const list = res.phases ?? [];
        setPhases(list);
        if (list.length > 0 && !activePhaseId) {
          setActivePhaseId(findCurrentPhaseCandidate(list)?.id ?? list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setPhasesLoading(false));
  }, [projectId, activePhaseId]);

  useEffect(() => {
    loadWorkspace();
    loadPhases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const openLogModal = () => {
    if (!currentManagedPhase) {
      message.warning("当前项目暂无可记录巡检的阶段");
      return;
    }
    if (!isViewingManagedPhase) {
      message.warning("请切回当前项目阶段后记录巡检");
      return;
    }
    if (!currentPhaseAllowsLog) {
      message.warning(currentPhaseLogBlockReason || "当前阶段不能记录巡检日志");
      return;
    }
    setLogImageList([]);
    logForm.resetFields();
    logForm.setFieldValue("photos", []);
    setLogModalOpen(true);
  };

  const activePhase = phases.find((p) => p.id === activePhaseId) ?? null;
  const workspaceCurrentPhase = String(workspace?.currentPhase || "").trim();
  const currentManagedPhase = findCurrentPhaseCandidate(
    phases,
    workspaceCurrentPhase,
  );
  const orderedPhases = [...phases].sort((a, b) => {
    const seqA = typeof a.seq === "number" ? a.seq : Number.MAX_SAFE_INTEGER;
    const seqB = typeof b.seq === "number" ? b.seq : Number.MAX_SAFE_INTEGER;
    return seqA - seqB || a.id - b.id;
  });
  const currentManagedPhaseIndex = currentManagedPhase
    ? orderedPhases.findIndex((phase) => phase.id === currentManagedPhase.id)
    : -1;
  const previousManagedPhase =
    currentManagedPhaseIndex > 0 ? orderedPhases[currentManagedPhaseIndex - 1] : null;
  const nextManagedPhase =
    currentManagedPhaseIndex >= 0 &&
    currentManagedPhaseIndex < orderedPhases.length - 1
      ? orderedPhases[currentManagedPhaseIndex + 1]
      : null;
  const previousPhaseEndDay = toValidDay(previousManagedPhase?.endDate);
  const nextPhaseStartDay = toValidDay(nextManagedPhase?.startDate);
  const isViewingManagedPhase = Boolean(
    activePhase && currentManagedPhase && activePhase.id === currentManagedPhase.id,
  );
  const currentManagedPhaseStatus = String(
    currentManagedPhase?.status || "",
  ).toLowerCase();
  const allowedPhaseActions = getPhaseActions(currentManagedPhaseStatus);
  const selectedPhaseActionMeta = selectedPhaseAction
    ? phaseActionMeta[selectedPhaseAction]
    : null;
  const currentPhaseAllowsLog =
    currentManagedPhaseStatus === "in_progress" ||
    currentManagedPhaseStatus === "paused";
  const currentPhaseLogBlockReason = !currentManagedPhase
    ? "当前项目暂无可记录巡检的阶段"
    : !isViewingManagedPhase
      ? "仅当前项目阶段可记录巡检"
      : currentManagedPhaseStatus === "pending"
        ? "当前阶段尚未开始，不能记录巡检日志"
        : currentManagedPhaseStatus === "completed"
          ? "当前阶段已完成，不能新增巡检日志"
          : currentPhaseAllowsLog
            ? ""
            : "当前阶段状态不允许记录巡检日志";
  const canCreateCurrentPhaseLog =
    Boolean(currentManagedPhase) && isViewingManagedPhase && currentPhaseAllowsLog;
  const projectKickoffDay = toValidDay(workspace?.plannedStartDate);
  const phaseStartLowerBound =
    projectKickoffDay && previousPhaseEndDay
      ? projectKickoffDay.isAfter(previousPhaseEndDay)
        ? projectKickoffDay
        : previousPhaseEndDay
      : projectKickoffDay || previousPhaseEndDay;

  const resolvePhaseResponsible = (
    phase: Pick<ProjectPhaseView, "responsiblePerson"> | null,
  ) => {
    const direct = String(phase?.responsiblePerson || "").trim();
    if (direct) return direct;
    const fallback = String(workspace?.currentResponsible || "").trim();
    if (fallback && fallback !== "暂无") return fallback;
    return "当前监理";
  };

  const shouldDisablePhaseStartDate = (current: Dayjs) => {
    if (!phaseStartLowerBound) return false;
    return current.startOf("day").isBefore(phaseStartLowerBound);
  };

  const shouldDisablePhaseEndDate = (current: Dayjs) => {
    const startDate = phaseForm.getFieldValue("startDate");
    const currentDay = current.startOf("day");
    const effectiveStartDate = dayjs.isDayjs(startDate)
      ? startDate.startOf("day")
      : toValidDay(currentManagedPhase?.startDate) || phaseStartLowerBound;
    if (effectiveStartDate && currentDay.isBefore(effectiveStartDate)) {
      return true;
    }
    return false;
  };

  const getDefaultPhaseStartDate = () =>
    latestDay(
      toValidDay(currentManagedPhase?.startDate),
      dayjs().startOf("day"),
      phaseStartLowerBound,
    ) || dayjs().startOf("day");

  const getDefaultPhaseEndDate = (startDate?: Dayjs | null) => {
    const defaultEndDate =
      latestDay(
        toValidDay(currentManagedPhase?.endDate),
        dayjs().startOf("day"),
        startDate,
      ) || dayjs().startOf("day");
    return defaultEndDate;
  };

  const openPhaseActionModal = () => {
    if (!currentManagedPhase) return;
    const defaultAction = allowedPhaseActions[0];
    if (!defaultAction) {
      message.info("当前阶段暂无可执行操作");
      return;
    }
    const defaultStartDate = getDefaultPhaseStartDate();
    phaseForm.setFieldsValue({
      action: defaultAction,
      startDate: defaultAction === "start" ? defaultStartDate : null,
      endDate: ["start", "complete"].includes(defaultAction)
        ? getDefaultPhaseEndDate(defaultStartDate)
        : null,
    });
    setPhaseActionModalOpen(true);
  };

  const handleSavePhase = async () => {
    if (!currentManagedPhase) return;
    try {
      const values = await phaseForm.validateFields();
      const action = values.action as PhaseAction | undefined;
      if (!action || !phaseActionMeta[action]) {
        message.warning("请选择阶段操作");
        return;
      }
      const payload: {
        status: string;
        startDate?: string;
        endDate?: string;
      } = {
        status: phaseActionMeta[action].targetStatus,
      };
      if (action === "start") {
        payload.startDate = values.startDate
          ? dayjs(values.startDate).format("YYYY-MM-DD")
          : undefined;
        payload.endDate = values.endDate
          ? dayjs(values.endDate).format("YYYY-MM-DD")
          : undefined;
      }
      if (action === "complete") {
        payload.endDate = values.endDate
          ? dayjs(values.endDate).format("YYYY-MM-DD")
          : undefined;
      }
      setPhaseSubmitting(true);
      await supervisorPhaseApi.update(projectId, currentManagedPhase.id, payload);
      message.success(`${phaseActionMeta[action].label}已提交`);
      setPhaseActionModalOpen(false);
      setActivePhaseId(
        action === "complete"
          ? nextManagedPhase?.id || currentManagedPhase.id
          : currentManagedPhase.id,
      );
      loadPhases();
      loadWorkspace();
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

  const syncLogImageList = (nextList: UploadFile[]) => {
    const limitedList = nextList.slice(0, MAX_LOG_PHOTOS);
    setLogImageList(limitedList);
    logForm.setFieldValue("photos", limitedList);
    void logForm.validateFields(["photos"]).catch(() => {});
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
      setLogImageList((prev) => {
        if (prev.length >= MAX_LOG_PHOTOS) {
          message.warning(`最多上传${MAX_LOG_PHOTOS}张现场照片`);
          return prev;
        }
        const nextList = [...prev, nextFile].slice(0, MAX_LOG_PHOTOS);
        logForm.setFieldValue("photos", nextList);
        void logForm.validateFields(["photos"]).catch(() => {});
        return nextList;
      });
      onSuccess?.(uploaded);
    } catch (error) {
      onError?.(error as Error);
      message.error(error instanceof Error ? error.message : "图片上传失败");
    }
  };

  const handleLogImageRemove = (file: UploadFile) => {
    syncLogImageList(logImageList.filter((item) => item.uid !== file.uid));
  };

  const beforeLogImageUpload = (file: RcFile) => {
    if (logImageList.length >= MAX_LOG_PHOTOS) {
      message.warning(`最多上传${MAX_LOG_PHOTOS}张现场照片`);
      return Upload.LIST_IGNORE;
    }
    const fileType = String(file.type || "").toLowerCase();
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(fileType)) {
      message.error("请上传 JPG/PNG/GIF/WEBP 图片");
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleCreateLog = async () => {
    if (!currentManagedPhase) {
      message.warning("当前项目暂无可记录巡检的阶段");
      return;
    }
    if (!isViewingManagedPhase) {
      message.warning("请切回当前项目阶段后记录巡检");
      return;
    }
    if (!currentPhaseAllowsLog) {
      message.warning(currentPhaseLogBlockReason || "当前阶段不能记录巡检日志");
      return;
    }
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
      await supervisorLogApi.create(projectId, currentManagedPhase.id, {
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
          className="supervisor-panel"
          bordered={false}
          style={{
            borderRadius: SUPERVISOR_THEME.cardRadius,
            textAlign: "center",
            padding: "60px 0",
          }}
        >
          <Empty description="项目不存在或无权访问" />
        </Card>
      </div>
    );
  }

  const cardStyle = { ...iosCardStyle, marginBottom: 24 };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="supervisor-page">
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
        >
          上报风险预警
        </Button>
      </div>

      {/* 核心看板 - Header */}
      <Card
        className="supervisor-panel"
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
            backgroundColor: SUPERVISOR_THEME.surfaceMuted,
            borderBottomLeftRadius: SUPERVISOR_THEME.cardRadius,
            borderBottomRightRadius: SUPERVISOR_THEME.cardRadius,
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
          className="supervisor-panel"
          bordered={false}
          style={{
            ...cardStyle,
            borderColor: "rgba(255, 59, 48, 0.22)",
            background: "rgba(255, 59, 48, 0.04)",
          }}
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
            className="supervisor-panel"
            title={<span style={{ fontWeight: 600 }}>阶段管控台</span>}
            bordered={false}
            style={cardStyle}
            extra={
              currentManagedPhase && (
                <Space size={10} wrap>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    当前项目阶段：
                    {currentManagedPhase.name ||
                      dicts.phaseType(currentManagedPhase.phaseType)}
                  </Text>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<EditOutlined />}
                    onClick={openPhaseActionModal}
                    shape="round"
                  >
                    更新当前阶段
                  </Button>
                </Space>
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
                      dot={
                        phase.status === "in_progress" ||
                        phase.status === "paused"
                      }
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
                          {resolvePhaseResponsible(phase)}
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
            className="supervisor-panel"
            title={
              <span style={{ fontWeight: 600 }}>
                现场巡检日志
                {activePhase
                  ? ` · ${activePhase.name || dicts.phaseType(activePhase.phaseType)}`
                  : ""}
              </span>
            }
            bordered={false}
            style={{ ...cardStyle, height: "100%" }}
            extra={
              <Tooltip title={currentPhaseLogBlockReason}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={openLogModal}
                  shape="round"
                  disabled={!canCreateCurrentPhaseLog}
                >
                  记录巡检
                </Button>
              </Tooltip>
            }
          >
            {logsLoading ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <Spin />
              </div>
            ) : logs.length === 0 ? (
              <Empty
                description={<Text type="secondary">当前阶段暂无巡检记录</Text>}
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
                        border: `1px solid ${SUPERVISOR_THEME.borderColor}`,
                        boxShadow: "none",
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
          <Form.Item label="当前阶段">
            <Tag color={dicts.phaseColor(currentManagedPhase?.status || "pending")}>
              {currentManagedPhase?.name ||
                dicts.phaseType(currentManagedPhase?.phaseType || "") ||
                "未选择阶段"}
            </Tag>
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
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp"
              maxCount={MAX_LOG_PHOTOS}
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

      {/* ── Modal: 当前阶段动作 ── */}
      <Modal
        title={
          <span style={{ fontWeight: 600 }}>
            更新当前阶段：
            {currentManagedPhase?.name || currentManagedPhase?.phaseType || ""}
          </span>
        }
        open={phaseActionModalOpen}
        onCancel={() => setPhaseActionModalOpen(false)}
        onOk={handleSavePhase}
        confirmLoading={phaseSubmitting}
        okText={selectedPhaseActionMeta?.label || "确认更新"}
        cancelText="取消"
        okButtonProps={{ shape: "round", disabled: allowedPhaseActions.length === 0 }}
        cancelButtonProps={{ shape: "round" }}
        width={460}
        destroyOnClose
      >
        <Form form={phaseForm} layout="vertical" size="large" style={{ marginTop: 20 }}>
          <Form.Item label="当前状态">
            <Tag
              color={dicts.phaseColor(currentManagedPhase?.status || "pending")}
              style={{ borderRadius: 12, padding: "2px 12px" }}
            >
              {dicts.phaseStatus(currentManagedPhase?.status || "pending")}
            </Tag>
          </Form.Item>
          <Form.Item
            name="action"
            label="阶段动作"
            rules={[{ required: true, message: "请选择阶段操作" }]}
          >
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={allowedPhaseActions.map((action) => ({
                label: phaseActionMeta[action].label,
                value: action,
              }))}
              onChange={(event) => {
                const action = event.target.value as PhaseAction;
                const defaultStartDate = getDefaultPhaseStartDate();
                phaseForm.setFieldsValue({
                  startDate: action === "start" ? defaultStartDate : null,
                  endDate: ["start", "complete"].includes(action)
                    ? getDefaultPhaseEndDate(defaultStartDate)
                    : null,
                });
              }}
            />
          </Form.Item>
          {selectedPhaseAction === "start" ? (
            <Form.Item
              name="startDate"
              label="计划开始时间"
              rules={[
                { required: true, message: "请选择计划开始时间" },
                {
                  validator(_, value) {
                    if (!value || !phaseStartLowerBound) {
                      return Promise.resolve();
                    }
                    if (value.startOf("day").isBefore(phaseStartLowerBound)) {
                      const lowerBoundLabel =
                        previousPhaseEndDay &&
                        phaseStartLowerBound.isSame(previousPhaseEndDay, "day")
                          ? `上一阶段计划完成时间（${previousPhaseEndDay.format("YYYY-MM-DD")}）`
                          : `项目开工时间（${phaseStartLowerBound.format("YYYY-MM-DD")}）`;
                      return Promise.reject(
                        new Error(`计划开始时间不能早于${lowerBoundLabel}`),
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                style={{ width: "100%" }}
                disabledDate={shouldDisablePhaseStartDate}
              />
            </Form.Item>
          ) : null}
          {selectedPhaseAction === "start" || selectedPhaseAction === "complete" ? (
            <Form.Item
              name="endDate"
              label="计划完成时间"
              dependencies={["startDate", "action"]}
              rules={[
                { required: true, message: "请选择计划完成时间" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value) {
                      return Promise.resolve();
                    }
                    const startDate = getFieldValue("startDate");
                    const effectiveStartDate = dayjs.isDayjs(startDate)
                      ? startDate.startOf("day")
                      : toValidDay(currentManagedPhase?.startDate) ||
                        phaseStartLowerBound;
                    if (
                      effectiveStartDate &&
                      value.startOf("day").isBefore(effectiveStartDate)
                    ) {
                      return Promise.reject(
                        new Error("计划完成时间不能早于计划开始时间"),
                      );
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker
                style={{ width: "100%" }}
                disabledDate={shouldDisablePhaseEndDate}
              />
            </Form.Item>
          ) : null}
          {projectKickoffDay ? (
            <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              项目开工时间：{projectKickoffDay.format("YYYY-MM-DD")}
            </Text>
          ) : null}
          {previousPhaseEndDay ? (
            <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              上一阶段计划完成时间：{previousPhaseEndDay.format("YYYY-MM-DD")}
            </Text>
          ) : null}
          {nextPhaseStartDay ? (
            <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              下一阶段计划开始时间：{nextPhaseStartDay.format("YYYY-MM-DD")}；如当前阶段延期，后续未开始阶段将自动顺延
            </Text>
          ) : null}
          <Divider style={{ margin: "12px 0 16px" }} />
          <Text type="secondary">责任人</Text>
          <div style={{ marginTop: 6, fontWeight: 500 }}>
            {resolvePhaseResponsible(currentManagedPhase)}
          </div>
          <Text
            type="secondary"
            style={{ display: "block", marginTop: 12, fontSize: 12 }}
          >
            监理仅更新当前阶段动作；阶段结构、责任归属和跨阶段批量顺延由运营/管理员处理。
          </Text>
        </Form>
      </Modal>

      {/* ── Modal: 上报风险 ── */}
      <Modal
        title={
          <>
            <WarningOutlined style={{ color: SUPERVISOR_THEME.errorColor }} />{" "}
            上报异常/风险
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
