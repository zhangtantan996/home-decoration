import { Button, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useEffect, useState } from "react";

import { request } from "@/utils/request";

import "./index.scss";

interface ProjectClosure {
  projectId: number;
  projectName: string;
  closureType: "normal" | "abnormal";
  closedReason: string;
  closedAt: string;
  refundAmount?: number;
  refundStatus?: string;
  settlementAmount?: number;
}

interface TimelineItem {
  title: string;
  content: string;
}

const formatDateTime = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
};

const buildRefundTimeline = (refundStatus?: string): TimelineItem[] => [
  { title: "申请退款", content: "已提交退款申请" },
  { title: "审核中", content: "平台审核中" },
  {
    title: "退款完成",
    content: refundStatus === "completed" ? "退款已到账" : "等待退款",
  },
];

export default function ProjectClosurePage() {
  const router = useRouter();
  const { projectId } = router.params;
  const [loading, setLoading] = useState(true);
  const [closure, setClosure] = useState<ProjectClosure | null>(null);

  useEffect(() => {
    void fetchClosureInfo();
  }, [projectId]);

  const fetchClosureInfo = async () => {
    if (!projectId) {
      setLoading(false);
      setClosure(null);
      return;
    }

    try {
      setLoading(true);
      const data = await request<ProjectClosure>({
        url: `/projects/${projectId}/closure`,
        method: "GET",
      });
      setClosure(data);
    } catch {
      Taro.showToast({
        title: "获取关闭信息失败",
        icon: "none",
      });
      setClosure(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="closure-container">
        <Text>加载中...</Text>
      </View>
    );
  }

  if (!closure) {
    return (
      <View className="closure-container">
        <Text>未找到关闭信息</Text>
      </View>
    );
  }

  const refundTimeline = buildRefundTimeline(closure.refundStatus);
  const closureTypeText =
    closure.closureType === "normal" ? "正常关闭" : "异常关闭";

  return (
    <View className="closure-container">
      <View className="closure-card">
        <Text className="closure-card__title">项目关闭信息</Text>
        <View className="info-row">
          <Text className="label">项目名称：</Text>
          <Text>{closure.projectName}</Text>
        </View>
        <View className="info-row">
          <Text className="label">关闭类型：</Text>
          <Text className="status-chip">{closureTypeText}</Text>
        </View>
        <View className="info-row">
          <Text className="label">关闭时间：</Text>
          <Text>{formatDateTime(closure.closedAt)}</Text>
        </View>
        <View className="info-row">
          <Text className="label">关闭原因：</Text>
          <Text>{closure.closedReason}</Text>
        </View>
      </View>

      {closure.closureType === "abnormal" && closure.refundAmount ? (
        <View className="closure-card refund-card">
          <Text className="closure-card__title">退款信息</Text>
          <View className="info-row">
            <Text className="label">退款金额：</Text>
            <Text className="amount">¥{closure.refundAmount.toFixed(2)}</Text>
          </View>
          <View className="info-row">
            <Text className="label">退款状态：</Text>
            <Text className="status-chip">
              {closure.refundStatus === "completed" ? "已退款" : "处理中"}
            </Text>
          </View>
          <View className="closure-timeline">
            {refundTimeline.map((item) => (
              <View key={item.title} className="closure-timeline__item">
                <View className="closure-timeline__dot" />
                <View className="closure-timeline__content">
                  <Text className="closure-timeline__title">{item.title}</Text>
                  <Text className="closure-timeline__desc">{item.content}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {closure.closureType === "normal" && closure.settlementAmount ? (
        <View className="closure-card settlement-card">
          <Text className="closure-card__title">结算信息</Text>
          <View className="info-row">
            <Text className="label">结算金额：</Text>
            <Text className="amount">¥{closure.settlementAmount.toFixed(2)}</Text>
          </View>
          <View className="info-row">
            <Text>项目已正常完成，剩余资金已结算给商家</Text>
          </View>
        </View>
      ) : null}

      <View className="action-buttons">
        <Button
          className="action-buttons__back"
          onClick={() => {
            Taro.navigateBack();
          }}
        >
          返回
        </Button>
      </View>
    </View>
  );
}
