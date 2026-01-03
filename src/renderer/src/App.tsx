import { AppProvider, useApp } from './context/AppContext'
import {
  GatewayStatus,
  AccountSelector,
  PortfolioView,
  AllocationEditor,
  AutoInvestPanel
} from './components'
import './styles.css'

function Dashboard(): React.JSX.Element {
  const { isLoading, error, isAuthenticated } = useApp()

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="header">
        <h1>IBKR Auto-Invest</h1>
        <div className="header-status">
          <GatewayStatus />
        </div>
      </header>

      {error && <div className="global-error">{error}</div>}

      <div className="main-content">
        <aside className="sidebar">
          <AccountSelector />
          <AllocationEditor />
        </aside>

        <main className="content">
          {isAuthenticated ? (
            <>
              <PortfolioView />
              <AutoInvestPanel />
            </>
          ) : (
            <div className="welcome">
              <h2>Welcome to IBKR Auto-Invest</h2>
              <p>
                This app helps you automatically invest your cash into a target portfolio allocation.
              </p>
              <ol>
                <li>Start the IBKR Gateway (if not already running)</li>
                <li>Login to your IBKR account via the browser</li>
                <li>Set your target allocation percentages for each stock/ETF</li>
                <li>Click "Auto-Invest" to distribute cash according to your allocation</li>
              </ol>
              <p className="paper-trading-note">
                💡 <strong>Tip:</strong> Test with a paper trading account first! Use your paper
                trading username when logging in.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  )
}

export default App
