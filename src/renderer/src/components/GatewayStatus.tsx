import { useApp } from '../context/AppContext'

export function GatewayStatus(): React.JSX.Element {
  const { gatewayStatus, isAuthenticated, startGateway, stopGateway, openLogin } = useApp()

  const statusColors = {
    stopped: '#888',
    starting: '#f59e0b',
    running: '#22c55e',
    error: '#ef4444'
  }

  const statusLabels = {
    stopped: 'Stopped',
    starting: 'Starting...',
    running: 'Running',
    error: 'Error'
  }

  return (
    <div className="gateway-status">
      <div className="status-header">
        <h3>IBKR Gateway</h3>
        <div className="status-indicator" style={{ backgroundColor: statusColors[gatewayStatus] }}>
          {statusLabels[gatewayStatus]}
        </div>
      </div>

      <div className="status-details">
        <div className="status-row">
          <span>Authentication:</span>
          <span className={isAuthenticated ? 'authenticated' : 'not-authenticated'}>
            {isAuthenticated ? '✓ Connected' : '✗ Not Connected'}
          </span>
        </div>
      </div>

      <div className="status-actions">
        {gatewayStatus === 'stopped' || gatewayStatus === 'error' ? (
          <button onClick={startGateway} className="btn btn-primary">
            Start Gateway
          </button>
        ) : gatewayStatus === 'running' ? (
          <>
            {!isAuthenticated && (
              <button onClick={openLogin} className="btn btn-primary">
                Login to IBKR
              </button>
            )}
            <button onClick={stopGateway} className="btn btn-secondary">
              Stop Gateway
            </button>
          </>
        ) : null}
      </div>

      {gatewayStatus === 'running' && !isAuthenticated && (
        <p className="hint">
          Click "Login to IBKR" to open the authentication page in your browser. Complete 2FA if
          required.
        </p>
      )}
    </div>
  )
}
