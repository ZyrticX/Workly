'use client'

import { Component, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRefresh = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          dir="rtl"
          className="flex min-h-[300px] items-center justify-center p-8"
        >
          <div className="glass-card shadow-ios rounded-2xl p-8 text-center space-y-4 max-w-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100/80">
              <span className="text-2xl">!</span>
            </div>

            <p className="text-base font-medium text-[#1B2E24]">
              משהו השתבש. נסה לרענן את הדף
            </p>

            <button
              type="button"
              onClick={this.handleRefresh}
              className="
                inline-flex items-center gap-2 rounded-xl
                bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-white
                shadow-ios transition-ios press-effect
                hover:bg-[var(--color-primary-dark)]
              "
            >
              <RefreshCw size={16} />
              רענן
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
