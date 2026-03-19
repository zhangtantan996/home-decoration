import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import router from './router'
import './index.css'

class AdminErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[admin-app] render failed', error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
          <div style={{ maxWidth: 720, width: '100%', background: '#fff', borderRadius: 16, boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)', padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, color: '#0f172a' }}>管理后台加载失败</h2>
            <p style={{ marginTop: 0, marginBottom: 12, color: '#475569', lineHeight: 1.7 }}>
              页面没有正常渲染，已拦截错误以避免白屏。请先刷新页面；如果仍然失败，请把下面这条错误信息发给我继续排查。
            </p>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0f172a', color: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 13, lineHeight: 1.6 }}>
              {this.state.error.message}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      <App>
        <AdminErrorBoundary>
          <RouterProvider router={router} />
        </AdminErrorBoundary>
      </App>
    </ConfigProvider>
  </StrictMode>,
)
