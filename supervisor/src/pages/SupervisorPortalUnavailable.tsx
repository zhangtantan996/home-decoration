import { Result } from "antd";

const SupervisorPortalUnavailable = () => (
  <Result
    status="info"
    title="监理端暂未开放"
    subTitle="监理工作台当前暂不开放使用。历史项目与监理记录已保留，后续恢复时可继续接入。"
  />
);

export default SupervisorPortalUnavailable;
