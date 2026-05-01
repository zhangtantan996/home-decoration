import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public override state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("user-web crashed", error, errorInfo);
  }

  private readonly handleReset = () => {
    this.setState({ hasError: false });
  };

  public override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="container page-stack">
        <section className="card error-block">
          <p className="kicker">User Web</p>
          <h1 className="page-title">页面异常</h1>
          <p className="page-subtitle">
            页面没有正常显示，请刷新页面或重新登录后再试。
          </p>
          <div className="inline-actions error-block__actions">
            <button
              className="button-secondary"
              type="button"
              onClick={this.handleReset}
            >
              重试
            </button>
            <button
              className="button-ghost"
              type="button"
              onClick={() => window.location.assign("/")}
            >
              返回首页
            </button>
          </div>
        </section>
      </main>
    );
  }
}
