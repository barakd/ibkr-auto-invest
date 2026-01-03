import { useApp } from '../context/AppContext'

export function AccountSelector(): React.JSX.Element {
  const { accounts, selectedAccountId, accountAliases, selectAccount, isAuthenticated } = useApp()

  if (!isAuthenticated) {
    return (
      <div className="account-selector">
        <h3>Account</h3>
        <p className="hint">Please authenticate to view accounts.</p>
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <div className="account-selector">
        <h3>Account</h3>
        <p className="hint">Loading accounts...</p>
      </div>
    )
  }

  return (
    <div className="account-selector">
      <h3>Account</h3>
      <select
        value={selectedAccountId}
        onChange={(e) => selectAccount(e.target.value)}
        className="select"
      >
        {accounts.map((accountId) => (
          <option key={accountId} value={accountId}>
            {accountAliases[accountId] || accountId}
          </option>
        ))}
      </select>
    </div>
  )
}
