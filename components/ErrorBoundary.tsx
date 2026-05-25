'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-white font-semibold mb-2">Something went wrong</p>
            <p className="text-[#525252] text-sm mb-4">Please refresh the page</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-[#C8F55A] text-black font-bold px-4 py-2 rounded-xl text-sm hover:bg-[#b8e040] transition-colors"
            >
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
