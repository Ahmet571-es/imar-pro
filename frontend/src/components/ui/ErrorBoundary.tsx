import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: '' }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorInfo = info.componentStack?.slice(0, 500) || ''
    this.setState({ errorInfo })
    // Log to console for debugging
    console.error('[imarPRO ErrorBoundary]', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' })
    this.props.onReset?.()
    // Force reload as last resort
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-danger" />
            </div>

            {/* Title */}
            <h1 className="text-xl font-bold text-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Beklenmeyen Bir Hata Oluştu
            </h1>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              Uygulama beklenmeyen bir durumla karşılaştı. Verileriniz güvende — lütfen yeniden deneyin.
            </p>

            {/* Error details (collapsible) */}
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-text-light cursor-pointer hover:text-text-muted transition-colors">
                  Teknik detaylar
                </summary>
                <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-xs font-mono text-red-700 break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-[10px] font-mono text-red-500 mt-2 max-h-32 overflow-auto whitespace-pre-wrap">
                      {this.state.errorInfo}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Yeniden Dene
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn-secondary flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Ana Sayfa
              </button>
            </div>

            {/* Branding */}
            <div className="mt-8 flex items-center justify-center gap-2 text-text-light">
              <div className="w-6 h-6 bg-primary-dark rounded-md flex items-center justify-center text-[9px] font-bold text-accent">
                iP
              </div>
              <span className="text-xs">imarPRO v3.0</span>
            </div>
            <p className="text-[10px] text-text-light mt-2">
              Sorun devam ediyorsa destek@imarpro.dev adresine hata detaylarını gönderin.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
