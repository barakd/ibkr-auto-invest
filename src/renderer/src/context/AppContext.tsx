import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'

interface AppState {
  // Gateway
  gatewayStatus: 'stopped' | 'starting' | 'running' | 'error'
  isAuthenticated: boolean

  // Account
  accounts: string[]
  selectedAccountId: string
  accountAliases: Record<string, string>

  // Portfolio
  cashUSD: number
  cashILS: number
  ilsToUsdRate: number
  positions: Position[]
  totalValue: number

  // Allocations
  allocations: Allocation[]
  bufferPercent: number

  // Loading states
  isLoading: boolean
  error: string | null
}

interface Position {
  symbol: string
  conid: number
  shares: number
  marketValue: number
  avgCost: number
  unrealizedPnl: number
  currentPercent: number
}

interface Allocation {
  symbol: string
  targetPercent: number
  conid?: number
}

interface AppContextType extends AppState {
  // Actions
  refreshGatewayStatus: () => Promise<void>
  startGateway: () => Promise<void>
  stopGateway: () => Promise<void>
  openLogin: () => Promise<void>
  checkAuth: () => Promise<boolean>
  refreshAccounts: () => Promise<void>
  selectAccount: (accountId: string) => Promise<void>
  refreshPortfolio: () => Promise<void>
  refreshAllocations: () => Promise<void>
  updateAllocations: (allocations: Allocation[]) => Promise<void>
  setBufferPercent: (percent: number) => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function useApp(): AppContextType {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}

interface AppProviderProps {
  children: ReactNode
}

export function AppProvider({ children }: AppProviderProps): React.JSX.Element {
  const [state, setState] = useState<AppState>({
    gatewayStatus: 'stopped',
    isAuthenticated: false,
    accounts: [],
    selectedAccountId: '',
    accountAliases: {},
    cashUSD: 0,
    cashILS: 0,
    ilsToUsdRate: 0.27,
    positions: [],
    totalValue: 0,
    allocations: [],
    bufferPercent: 0.05,
    isLoading: true,
    error: null
  })

  const setPartialState = useCallback((partial: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  // Gateway actions
  const refreshGatewayStatus = useCallback(async () => {
    try {
      const status = await window.ibkr.gateway.getStatus()
      setPartialState({ gatewayStatus: status })
    } catch (error) {
      console.error('Failed to get gateway status:', error)
    }
  }, [setPartialState])

  const startGateway = useCallback(async () => {
    setPartialState({ gatewayStatus: 'starting' })
    try {
      const success = await window.ibkr.gateway.start()
      setPartialState({ gatewayStatus: success ? 'running' : 'error' })
    } catch (error) {
      setPartialState({ gatewayStatus: 'error', error: String(error) })
    }
  }, [setPartialState])

  const stopGateway = useCallback(async () => {
    try {
      await window.ibkr.gateway.stop()
      setPartialState({ gatewayStatus: 'stopped', isAuthenticated: false })
    } catch (error) {
      console.error('Failed to stop gateway:', error)
    }
  }, [setPartialState])

  // Auth actions
  const checkAuth = useCallback(async () => {
    try {
      const status = await window.ibkr.auth.getStatus()
      setPartialState({ isAuthenticated: status.authenticated })
      return status.authenticated
    } catch (error) {
      setPartialState({ isAuthenticated: false })
      return false
    }
  }, [setPartialState])

  // Account actions
  const refreshAccounts = useCallback(async () => {
    try {
      const response = await window.ibkr.accounts.list()
      setPartialState({
        accounts: response.accounts,
        accountAliases: response.aliases,
        selectedAccountId: response.selectedAccount || response.accounts[0] || ''
      })
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    }
  }, [setPartialState])

  const openLogin = useCallback(async () => {
    await window.ibkr.gateway.openLogin()
    // Poll after opening login window until authenticated
    let attempts = 0
    const pollInterval = setInterval(async () => {
      attempts++
      const authenticated = await checkAuth()
      if (authenticated) {
        clearInterval(pollInterval)
        await refreshAccounts()
      }
      // Stop after 24 attempts (2 minutes at 5 second intervals)
      if (attempts >= 24) {
        clearInterval(pollInterval)
      }
    }, 5000)
  }, [checkAuth, refreshAccounts])

  const selectAccount = useCallback(
    async (accountId: string) => {
      setPartialState({ selectedAccountId: accountId })
      await window.ibkr.settings.setAccount(accountId)
    },
    [setPartialState]
  )

  // Portfolio actions
  const refreshPortfolio = useCallback(async () => {
    if (!state.selectedAccountId) return

    try {
      // Get ledger
      const ledger = await window.ibkr.accounts.getLedger(state.selectedAccountId)
      const cashUSD = (ledger['USD'] as { cashbalance?: number })?.cashbalance || 0
      const cashILS = (ledger['ILS'] as { cashbalance?: number })?.cashbalance || 0

      // Get exchange rate
      let ilsToUsdRate = 0.27
      try {
        const rateResponse = await window.ibkr.accounts.getExchangeRate('ILS', 'USD')
        ilsToUsdRate = rateResponse.rate
      } catch {
        console.warn('Could not fetch exchange rate')
      }

      // Get positions
      const rawPositions = await window.ibkr.portfolio.getPositions(state.selectedAccountId)
      const positions: Position[] = (rawPositions as Array<{
        ticker?: string
        conid: number
        position: number
        mktValue: number
        avgCost: number
        unrealizedPnl: number
      }>).filter((p) => p.ticker).map((p) => ({
        symbol: p.ticker || 'Unknown',
        conid: p.conid,
        shares: p.position,
        marketValue: p.mktValue,
        avgCost: p.avgCost,
        unrealizedPnl: p.unrealizedPnl,
        currentPercent: 0 // Will be calculated below
      }))

      // Calculate total value
      const stocksValue = positions.reduce((sum, p) => sum + p.marketValue, 0)
      const totalValue = stocksValue + cashUSD + cashILS * ilsToUsdRate

      // Calculate percentages
      positions.forEach((p) => {
        p.currentPercent = totalValue > 0 ? (p.marketValue / totalValue) * 100 : 0
      })

      setPartialState({
        cashUSD,
        cashILS,
        ilsToUsdRate,
        positions,
        totalValue
      })
    } catch (error) {
      console.error('Failed to refresh portfolio:', error)
      setPartialState({ error: String(error) })
    }
  }, [state.selectedAccountId, setPartialState])

  // Allocation actions
  const refreshAllocations = useCallback(async () => {
    try {
      const settings = await window.ibkr.settings.get()
      setPartialState({
        allocations: settings.allocations,
        bufferPercent: settings.bufferPercent,
        selectedAccountId: settings.selectedAccountId || state.selectedAccountId
      })
    } catch (error) {
      console.error('Failed to refresh allocations:', error)
    }
  }, [setPartialState, state.selectedAccountId])

  const updateAllocations = useCallback(
    async (allocations: Allocation[]) => {
      await window.ibkr.allocations.set(allocations)
      setPartialState({ allocations })
    },
    [setPartialState]
  )

  const setBufferPercent = useCallback(
    async (percent: number) => {
      await window.ibkr.settings.setBuffer(percent)
      setPartialState({ bufferPercent: percent })
    },
    [setPartialState]
  )

  // Initialize on mount
  useEffect(() => {
    async function init() {
      setPartialState({ isLoading: true })
      await refreshGatewayStatus()
      await refreshAllocations()
      // Also check auth status immediately
      await checkAuth()
      setPartialState({ isLoading: false })
    }
    init()
  }, [refreshGatewayStatus, refreshAllocations, checkAuth, setPartialState])

  // Poll for auth status when gateway is running
  useEffect(() => {
    if (state.gatewayStatus !== 'running') return

    // Check auth immediately when gateway becomes running
    checkAuth().then((authenticated) => {
      if (authenticated && state.accounts.length === 0) {
        refreshAccounts()
      }
    })

    // Then poll once per minute
    const interval = setInterval(async () => {
      const authenticated = await checkAuth()
      if (authenticated && state.accounts.length === 0) {
        await refreshAccounts()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [state.gatewayStatus, state.accounts.length, checkAuth, refreshAccounts])

  // Refresh portfolio when account changes
  useEffect(() => {
    if (state.selectedAccountId && state.isAuthenticated) {
      refreshPortfolio()
    }
  }, [state.selectedAccountId, state.isAuthenticated, refreshPortfolio])

  const contextValue: AppContextType = {
    ...state,
    refreshGatewayStatus,
    startGateway,
    stopGateway,
    openLogin,
    checkAuth,
    refreshAccounts,
    selectAccount,
    refreshPortfolio,
    refreshAllocations,
    updateAllocations,
    setBufferPercent
  }

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}
