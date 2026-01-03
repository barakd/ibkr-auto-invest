import { useApp } from '../context/AppContext'

export function PortfolioView(): React.JSX.Element {
  const {
    isAuthenticated,
    selectedAccountId,
    cashUSD,
    cashILS,
    ilsToUsdRate,
    positions,
    totalValue,
    refreshPortfolio
  } = useApp()

  if (!isAuthenticated || !selectedAccountId) {
    return (
      <div className="portfolio-view">
        <h3>Portfolio</h3>
        <p className="hint">Please authenticate and select an account.</p>
      </div>
    )
  }

  const formatCurrency = (value: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2
    }).format(value)
  }

  return (
    <div className="portfolio-view">
      <div className="section-header">
        <h3>Portfolio</h3>
        <button onClick={refreshPortfolio} className="btn btn-small">
          Refresh
        </button>
      </div>

      <div className="balance-summary">
        <div className="balance-card">
          <span className="label">Total Value</span>
          <span className="value">{formatCurrency(totalValue)}</span>
        </div>
        <div className="balance-card">
          <span className="label">Cash (USD)</span>
          <span className="value">{formatCurrency(cashUSD)}</span>
        </div>
        <div className="balance-card">
          <span className="label">Cash (ILS)</span>
          <span className="value">{formatCurrency(cashILS, 'ILS')}</span>
          <span className="subvalue">≈ {formatCurrency(cashILS * ilsToUsdRate)}</span>
        </div>
        <div className="balance-card">
          <span className="label">ILS/USD Rate</span>
          <span className="value">{ilsToUsdRate.toFixed(4)}</span>
        </div>
      </div>

      {positions.length > 0 && (
        <div className="positions-table">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="right">Shares</th>
                <th className="right">Market Value</th>
                <th className="right">Avg Cost</th>
                <th className="right">P&L</th>
                <th className="right">% of Portfolio</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.conid}>
                  <td className="symbol">{position.symbol}</td>
                  <td className="right">{position.shares}</td>
                  <td className="right">{formatCurrency(position.marketValue)}</td>
                  <td className="right">{formatCurrency(position.avgCost)}</td>
                  <td className={`right ${position.unrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(position.unrealizedPnl)}
                  </td>
                  <td className="right">{position.currentPercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {positions.length === 0 && (
        <p className="hint">No positions found in this account.</p>
      )}
    </div>
  )
}
