import { Result } from "antd";
import SupervisorBrand from "../components/SupervisorBrand";
import { useSupervisorDocumentBranding } from "../utils/branding";
import { SUPERVISOR_THEME } from "../constants/supervisorTheme";

const SupervisorPortalUnavailable = () => {
  useSupervisorDocumentBranding("禾泽云 · 监理端暂未开放");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      className="supervisor-login-bg"
    >
      <div
        className="supervisor-login-card"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: "32px 24px",
          borderRadius: SUPERVISOR_THEME.cardRadius,
          background: SUPERVISOR_THEME.surface,
          boxShadow: SUPERVISOR_THEME.softShadow,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <SupervisorBrand
            centered
            size="lg"
            title="禾泽云 · 监理端"
            subtitle="当前暂未开放使用"
          />
        </div>
        <Result
          status="info"
          title="监理端暂未开放"
          subTitle="监理工作台当前暂不开放使用。历史项目与监理记录已保留，后续恢复时可继续接入。"
        />
      </div>
    </div>
  );
};

export default SupervisorPortalUnavailable;
