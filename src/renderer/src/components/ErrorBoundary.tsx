import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
    window.electronApi?.logRenderer({
      level: 'error',
      message: error.message,
      stack: error.stack,
      context: 'error-boundary'
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          background: '#f7f8fa',
          color: '#111827',
          fontFamily: "'Inter','Microsoft YaHei',sans-serif",
          padding: 32,
          textAlign: 'center',
          gap: 12
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>应用出现异常</h2>
          <p style={{ fontSize: 13, color: '#6b7280', maxWidth: 400, lineHeight: 1.5, margin: 0 }}>
            {this.state.error?.message || '未知错误'}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                border: 'none',
                background: '#00A1D6',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              刷新页面
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }) }}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                cursor: 'pointer'
              }}
            >
              重试渲染
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
