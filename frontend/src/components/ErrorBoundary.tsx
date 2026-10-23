import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { message: string | null; requestId: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null, requestId: null }

  static getDerivedStateFromError(error: Error): State {
    return {
      message: error.message || 'The screen could not be rendered.',
      requestId: null,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AfyaSasa render failure', { error, info })
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <div className="m-6 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
        <p className="text-lg font-semibold">This screen failed to load</p>
        <p className="mt-2 text-sm">{this.state.message}</p>
        <p className="mt-2 text-sm text-rose-800">
          Patient work in other modules is unchanged. Reload this page. If it continues, contact IT with the time of the error.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-rose-800 px-4 py-2 text-sm font-medium text-white"
          onClick={() => this.setState({ message: null, requestId: null })}
        >
          Try again
        </button>
      </div>
    )
  }
}
