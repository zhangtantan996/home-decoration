import React, { useEffect, useState } from "react";
import {
  Card,
  Descriptions,
  Tag,
  Spin,
  Empty,
  Typography,
  Result,
  Image,
} from "antd";
import { SafetyOutlined } from "@ant-design/icons";
import { supervisorProfileApi } from "../../services/supervisorApi";
import { useRegionStore } from "../../stores/regionStore";
import { useSupervisorAuthStore } from "../../stores/supervisorAuthStore";
import type { SupervisorSession } from "../../stores/supervisorAuthStore";
import { SUPERVISOR_THEME } from "../../constants/supervisorTheme";

const { Text } = Typography;

interface ProfileData {
  id: number;
  realName: string;
  phone: string;
  cityCode: string;
  serviceArea: string;
  certifications: string;
  status: number;
  verified: boolean;
}

const statusColor: Record<number, string> = { 1: "success", 0: "error" };
const statusLabel: Record<number, string> = { 1: "正常", 0: "已禁用" };

const SupervisorProfile: React.FC = () => {
  const { supervisor: storeProfile, updateProfile } = useSupervisorAuthStore();
  const [loading, setLoading] = useState(!storeProfile); // 如果 Store 有数据，就不显示全局 Loading
  const [error, setError] = useState(false);
  const hasStoreProfile = Boolean(storeProfile);

  const { fetchCities, fetchDistricts, getCityName, getDistrictMap } =
    useRegionStore();

  useEffect(() => {
    const fetchAllData = async () => {
      // 如果没数据，显示加载中
      if (!hasStoreProfile) setLoading(true);

      try {
        // 1. 获取最新基本资料
        const data = (await supervisorProfileApi.getInfo()) as ProfileData;
        const updatedProfile: SupervisorSession = {
          accountId: data.id, // 这里后端返回的 id 其实是 supervisorProfile 的 ID
          supervisorId: data.id,
          phone: data.phone,
          realName: data.realName,
          cityCode: data.cityCode,
          serviceArea: data.serviceArea,
          certifications: data.certifications,
          status: data.status,
          verified: data.verified,
        };
        updateProfile(updatedProfile);

        // 2. 并行获取区域数据（这些都有缓存）
        if (data.cityCode) {
          await Promise.all([fetchCities(), fetchDistricts(data.cityCode)]);
        } else {
          await fetchCities();
        }
      } catch (err) {
        console.error("Fetch profile error:", err);
        if (!hasStoreProfile) setError(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchAllData();
  }, [fetchCities, fetchDistricts, hasStoreProfile, updateProfile]);

  // 优先使用最新的 store 数据
  const profile = storeProfile;

  if (loading && !profile) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <Result
        status="error"
        title="获取资料失败"
        subTitle="请刷新页面重试，或联系管理员。"
      />
    );
  }

  const cityName = getCityName(profile.cityCode);
  const districtMap = getDistrictMap(profile.cityCode);

  const parseTags = (raw: string): string[] => {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return raw ? [raw] : [];
    }
  };

  return (
    <div className="supervisor-page">
      <Card
        className="supervisor-panel"
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SafetyOutlined />
            <span>个人资料</span>
          </div>
        }
      >
        {profile && (
          <Descriptions column={{ xs: 1, sm: 2 }} size="default" bordered>
            <Descriptions.Item label="姓名">
              {profile.realName}
            </Descriptions.Item>
            <Descriptions.Item label="手机号">
              <Text copyable>{profile.phone}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="账号状态">
              <Tag color={statusColor[profile.status] ?? "default"}>
                {statusLabel[profile.status] ?? "未知"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="认证状态">
              <Tag color={profile.verified ? "success" : "warning"}>
                {profile.verified ? "已认证" : "未认证"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="服务城市">
              {cityName || profile.cityCode || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="服务区县">
              {parseTags(profile.serviceArea).length > 0
                ? parseTags(profile.serviceArea).map((code) => (
                    <Tag key={code} color="blue">
                      {districtMap[code] || code}
                    </Tag>
                  ))
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="资质材料" span={{ xs: 1, sm: 2 }}>
              {parseTags(profile.certifications).length > 0 ? (
                <Image.PreviewGroup>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    {parseTags(profile.certifications).map((url, idx) => (
                      <Image
                        key={idx}
                        width={160}
                        height={100}
                        src={url}
                        style={{
                          objectFit: "cover",
                          borderRadius: 10,
                          border: `1px solid ${SUPERVISOR_THEME.borderColor}`,
                        }}
                      />
                    ))}
                  </div>
                </Image.PreviewGroup>
              ) : (
                <Empty
                  description="暂无资质信息"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </div>
  );
};

export default SupervisorProfile;
