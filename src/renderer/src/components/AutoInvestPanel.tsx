import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { AutoInvestPlan, AutoInvestResult } from '../../../preload/index.d'

export function AutoInvestPanel(): React.JSX.Element {
  const { isAuthenticated, selectedAccountId, allocations } = useApp()

  const [plan, setPlan] = useState<AutoInvestPlan | null>(null)
  const [result, setResult] = useState<AutoInvestResult | null>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState('')

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const handleCreatePlan = async () => {
    if (!selectedAccountId) {
      setError('Please select an account first')
      return
    }

    setIsPlanning(true)
    setError('')
    setPlan(null)
    setResult(null)

    try {
      const newPlan = (await window.ibkr.autoInvest.createPlan(selectedAccountId)) as AutoInvestPlan
      setPlan(newPlan)
    } catch (err) {
      setError(`Failed to create plan: ${err}`)
    } finally {
      setIsPlanning(false)
    }
  }

  const handleExecute = async () => {
    if (!selectedAccountId || !plan) {
      return
    }

    const confirmed = confirm(
      `Are you sure you want to execute this auto-invest plan?\n\n` +
        `This will place ${plan.ordersToPlace.length} market order(s) ` +
        `totaling approximately ${formatCurrency(plan.ordersToPlace.reduce((sum, o) => sum + o.estimatedCost, 0))}.`
    )

    if (!confirmed) return

    setIsExecuting(true)
    setError('')

    try {
      const executionResult = (await window.ibkr.autoInvest.execute(
        selectedAccountId
      )) as AutoInvestResult
      setResult(executionResult)
      setPlan(null)
    } catch (err) {
      setError(`Failed to execute: ${err}`)
    } finally {
      setIsExecuting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="auto-invest-panel">
        <h3>Auto-Invest</h3>
        <p className="hint">Please authenticate to use auto-invest.</p>
      </div>
    )
  }

  if (allocations.length === 0) {
    return (
      <div className="auto-invest-panel">
        <h3>Auto-Invest</h3>
        <p className="hint">Please set up your target allocation first.</p>
      </div>
    )
  }

  return (
    <div className="auto-invest-panel">
      <h3>Auto-Invest</h3>

      <p className="description">
        Auto-invest will analyze your current portfolio, convert ILS to USD if needed, and
        distribute available cash to bring your positions closer to target allocation.
      </p>

      {!plan && !result && (
        <button onClick={handleCreatePlan} disabled={isPlanning} className="btn btn-primary">
          {isPlanning ? 'Analyzing...' : 'Create Investment Plan'}
        </button>
      )}

      {error && <div className="error-message">{error}</div>}

      {plan && (
        <div className="plan-preview">
          <h4>Investment Plan</h4>

          <div className="plan-summary">
            <div className="plan-stat">
              <span className="label">Available Cash</span>
              <span className="value">{formatCurrency(plan.totalAvailableUSD)}</span>
            </div>
            {plan.ilsToConvert > 0 && (
              <div className="plan-stat">
                <span className="label">ILS to Convert</span>
                <span className="value">
                  ₪{plan.ilsToConvert.toFixed(2)} → {formatCurrency(plan.ilsToConvert * plan.ilsToUsdRate)}
                </span>
              </div>
            )}
          </div>

          <p className="plan-message">{plan.summary}</p>

          {plan.ordersToPlace.length > 0 && (
            <div className="planned-orders">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Symbol</th>
                    <th className="right">Shares</th>
                    <th className="right">Est. Cost</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.ordersToPlace.map((order, index) => (
                    <tr key={index}>
                      <td>{order.priority}</td>
                      <td className="symbol">{order.symbol}</td>
                      <td className="right">{order.shares}</td>
                      <td className="right">{formatCurrency(order.estimatedCost)}</td>
                      <td className="reason">{order.reason}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Total</strong></td>
                    <td className="right">
                      <strong>
                        {formatCurrency(
                          plan.ordersToPlace.reduce((sum, o) => sum + o.estimatedCost, 0)
                        )}
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="plan-actions">
            <button onClick={handleExecute} disabled={isExecuting || plan.ordersToPlace.length === 0} className="btn btn-success">
              {isExecuting ? 'Executing...' : 'Execute Plan'}
            </button>
            <button onClick={() => setPlan(null)} disabled={isExecuting} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={`execution-result ${result.success ? 'success' : 'partial'}`}>
          <h4>{result.success ? '✓ Execution Complete' : '⚠ Execution Completed with Issues'}</h4>

          <div className="result-summary">
            <div className="result-stat">
              <span className="label">Orders Placed</span>
              <span className="value">{result.ordersPlaced}</span>
            </div>
            <div className="result-stat">
              <span className="label">Orders Failed</span>
              <span className="value">{result.ordersFailed}</span>
            </div>
            <div className="result-stat">
              <span className="label">Total Invested</span>
              <span className="value">{formatCurrency(result.totalInvested)}</span>
            </div>
          </div>

          <div className="result-details">
            {result.results.map((r, index) => (
              <div key={index} className={`result-row ${r.status}`}>
                <span className="symbol">{r.symbol}</span>
                <span className="shares">{r.shares} shares</span>
                <span className="status-badge">{r.status}</span>
                <span className="message">{r.message}</span>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="errors">
              {result.errors.map((err, index) => (
                <div key={index} className="error-line">{err}</div>
              ))}
            </div>
          )}

          <button onClick={() => setResult(null)} className="btn btn-secondary">
            Done
          </button>
        </div>
      )}
    </div>
  )
}
