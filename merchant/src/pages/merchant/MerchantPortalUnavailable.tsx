import { Result } from 'antd';

const MerchantPortalUnavailable = () => (
  <Result
    status="info"
    title="商家端暂未开放"
    subTitle="平台当前由运营人员统一维护商家资料。历史数据已保留，恢复开放后可继续使用。"
  />
);

export default MerchantPortalUnavailable;
