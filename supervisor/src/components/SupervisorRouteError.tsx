import { Button, Result, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

const { Paragraph } = Typography;

const getErrorMessage = (error: unknown): string => {
  if (isRouteErrorResponse(error)) {
    return error.status === 404 ? "页面不存在" : "页面加载失败";
  }

  if (
    error instanceof Error &&
    /dynamically imported module/i.test(error.message)
  ) {
    return "页面加载失败，请刷新重试";
  }

  return "页面暂时无法打开";
};

export default function SupervisorRouteError() {
  const error = useRouteError();

  return (
    <div className="supervisor-route-error">
      <Result
        status="warning"
        title={getErrorMessage(error)}
        subTitle="可能是网络波动或系统正在更新，如果刷新后仍然异常，请联系管理员处理。"
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        }
      />
      <Paragraph type="secondary">当前操作不会影响已保存的项目信息。</Paragraph>
    </div>
  );
}
