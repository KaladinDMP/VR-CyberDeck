import React from 'react'

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  handleReset = (): void => {
    // Wipe all known preference keys so stale data can't re-trigger the crash
    try {
      localStorage.removeItem('avr-table-prefs-v1')
      localStorage.removeItem('avr-table-prefs-v2')
    } catch { /* ignore */ }
    window.location.reload()
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050514',
        gap: '20px',
        fontFamily: '"Courier New", Courier, monospace',
        padding: '40px'
      }}>
        <div style={{ fontSize: '32px', color: '#39ff14', letterSpacing: '0.1em' }}>
          // SYSTEM FAULT
        </div>
        <div style={{
          fontSize: '12px',
          color: 'rgba(255, 68, 68, 0.9)',
          background: 'rgba(255,68,68,0.06)',
          border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: '6px',
          padding: '16px 24px',
          maxWidth: '600px',
          wordBreak: 'break-word',
          textAlign: 'center',
          lineHeight: '1.6'
        }}>
          {this.state.message || 'An unexpected error occurred.'}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(57,255,20,0.5)', textAlign: 'center', maxWidth: '500px', lineHeight: '1.6' }}>
          Saved preferences will be cleared to prevent this from happening again.
        </div>
        <button
          onClick={this.handleReset}
          style={{
            background: 'transparent',
            border: '1px solid rgba(57,255,20,0.5)',
            color: '#39ff14',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '10px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(57,255,20,0.15)'
          }}
        >
          Reset &amp; Reload
        </button>
      </div>
    )
  }
}
