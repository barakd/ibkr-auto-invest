import { ipcMain, BrowserWindow } from 'electron'
import { gatewayManager } from '../gateway/GatewayManager'
import { allocationStore, Allocation } from '../store/AllocationStore'
import * as ibkr from '../services/ibkr'
import * as autoinvest from '../services/autoinvest'

// IPC Channel names
export const IPC_CHANNELS = {
  // Gateway
  GATEWAY_START: 'gateway:start',
  GATEWAY_STOP: 'gateway:stop',
  GATEWAY_STATUS: 'gateway:status',
  GATEWAY_OPEN_LOGIN: 'gateway:openLogin',

  // Auth
  AUTH_STATUS: 'auth:status',

  // Accounts
  ACCOUNTS_LIST: 'accounts:list',
  ACCOUNTS_LEDGER: 'accounts:ledger',
  ACCOUNTS_SUMMARY: 'accounts:summary',
  ACCOUNTS_EXCHANGE_RATE: 'accounts:exchangeRate',

  // Portfolio
  PORTFOLIO_POSITIONS: 'portfolio:positions',
  PORTFOLIO_INVALIDATE: 'portfolio:invalidate',

  // Orders
  ORDERS_PREVIEW: 'orders:preview',
  ORDERS_PLACE: 'orders:place',
  ORDERS_LIVE: 'orders:live',
  ORDERS_CANCEL: 'orders:cancel',

  // Securities
  SECDEF_SEARCH: 'secdef:search',
  SECDEF_INFO: 'secdef:info',

  // Allocations (local storage)
  ALLOCATIONS_GET: 'allocations:get',
  ALLOCATIONS_SET: 'allocations:set',
  ALLOCATIONS_UPSERT: 'allocations:upsert',
  ALLOCATIONS_REMOVE: 'allocations:remove',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET_ACCOUNT: 'settings:setAccount',
  SETTINGS_SET_BUFFER: 'settings:setBuffer',

  // Auto-invest
  AUTOINVEST_ANALYZE: 'autoinvest:analyze',
  AUTOINVEST_PLAN: 'autoinvest:plan',
  AUTOINVEST_EXECUTE: 'autoinvest:execute'
} as const

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  // Gateway handlers
  ipcMain.handle(IPC_CHANNELS.GATEWAY_START, async () => {
    return gatewayManager.start()
  })

  ipcMain.handle(IPC_CHANNELS.GATEWAY_STOP, async () => {
    return gatewayManager.stop()
  })

  ipcMain.handle(IPC_CHANNELS.GATEWAY_STATUS, async () => {
    // If we think it's stopped, double-check by querying the server
    const internalStatus = gatewayManager.getStatus()
    if (internalStatus === 'stopped' || internalStatus === 'error') {
      const isActuallyRunning = await gatewayManager.checkIfRunning()
      if (isActuallyRunning) {
        return 'running'
      }
    }
    return internalStatus
  })

  ipcMain.handle(IPC_CHANNELS.GATEWAY_OPEN_LOGIN, async () => {
    // Open login in an Electron window
    // The IBKR Gateway handles session internally - after login through the browser,
    // the gateway itself becomes authenticated and API calls work.
    const loginWindow = new BrowserWindow({
      width: 900,
      height: 750,
      title: 'IBKR Login',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: undefined
      }
    })

    // Certificate verification is already handled by the default session in main/index.ts

    loginWindow.loadURL('https://localhost:5003')

    let loginCompleted = false

    // Monitor navigation for login completion
    // The gateway maintains its own session - no cookies needed
    loginWindow.webContents.on('did-navigate', async (_, url) => {
      console.log('Login window navigated to:', url)
      
      // The successful login flow ends at the main portal page
      if (
        url === 'https://localhost:5003/' ||
        url === 'https://localhost:5003' ||
        url.includes('localhost:5003/portal') ||
        url.includes('localhost:5003/?')
      ) {
        if (!loginCompleted) {
          loginCompleted = true
          console.log('Login appears successful - at main portal')
          
          // Give the gateway a moment to finalize the session, then init brokerage
          setTimeout(async () => {
            try {
              console.log('Initializing brokerage session...')
              const initResult = await ibkr.initBrokerageSession()
              console.log('Brokerage session init result:', JSON.stringify(initResult))
            } catch (e) {
              console.log('Brokerage session init error:', e)
            }
            loginWindow.close()
          }, 1500)
        }
      }
    })

    // Also detect based on page content
    loginWindow.webContents.on('did-finish-load', async () => {
      try {
        // Check if we see "Client login succeeds" message
        const pageText = await loginWindow.webContents.executeJavaScript(
          'document.body?.innerText || ""'
        )
        if (pageText.includes('Client login succeeds')) {
          if (!loginCompleted) {
            loginCompleted = true
            console.log('Login succeeded - detected success message')
            
            setTimeout(async () => {
              try {
                console.log('Initializing brokerage session...')
                const initResult = await ibkr.initBrokerageSession()
                console.log('Brokerage session init result:', JSON.stringify(initResult))
              } catch (e) {
                console.log('Brokerage session init error:', e)
              }
              loginWindow.close()
            }, 2000)
          }
        }
      } catch {
        // Ignore errors from JS execution
      }
    })

    return true
  })

  // Auth handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    return ibkr.getAuthStatus()
  })

  // Accounts handlers
  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_LIST, async () => {
    const response = await ibkr.getAccounts()
    // Filter out "All" pseudo-account - it's not a real account for trading/positions
    const realAccounts = response.accounts.filter(acc => acc !== 'All')
    // Use stored account preference if valid, otherwise use IBKR's selection or first real account
    const storedAccount = allocationStore.getSelectedAccountId()
    const selectedAccount = realAccounts.includes(storedAccount)
      ? storedAccount
      : realAccounts.includes(response.selectedAccount)
        ? response.selectedAccount
        : realAccounts[0] || ''
    return {
      ...response,
      accounts: realAccounts,
      selectedAccount
    }
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_LEDGER, async (_, accountId: string) => {
    return ibkr.getAccountLedger(accountId)
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNTS_SUMMARY, async (_, accountId: string) => {
    return ibkr.getAccountSummary(accountId)
  })

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNTS_EXCHANGE_RATE,
    async (_, source: string, target: string) => {
      return ibkr.getExchangeRate(source, target)
    }
  )

  // Portfolio handlers
  ipcMain.handle(IPC_CHANNELS.PORTFOLIO_POSITIONS, async (_, accountId: string) => {
    return ibkr.getAllPositions(accountId)
  })

  ipcMain.handle(IPC_CHANNELS.PORTFOLIO_INVALIDATE, async (_, accountId: string) => {
    return ibkr.invalidateCache(accountId)
  })

  // Orders handlers
  ipcMain.handle(
    IPC_CHANNELS.ORDERS_PREVIEW,
    async (_, accountId: string, orders: ibkr.OrderRequest[]) => {
      return ibkr.previewOrder(accountId, orders)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.ORDERS_PLACE,
    async (_, accountId: string, orders: ibkr.OrderRequest[]) => {
      return ibkr.placeOrder(accountId, orders)
    }
  )

  ipcMain.handle(IPC_CHANNELS.ORDERS_LIVE, async () => {
    return ibkr.getLiveOrders()
  })

  ipcMain.handle(
    IPC_CHANNELS.ORDERS_CANCEL,
    async (_, accountId: string, orderId: string) => {
      return ibkr.cancelOrder(accountId, orderId)
    }
  )

  // Securities handlers
  ipcMain.handle(IPC_CHANNELS.SECDEF_SEARCH, async (_, symbol: string) => {
    return ibkr.searchSecurity(symbol)
  })

  ipcMain.handle(IPC_CHANNELS.SECDEF_INFO, async (_, conid: number) => {
    return ibkr.getContractInfo(conid)
  })

  // Allocations handlers (local storage)
  ipcMain.handle(IPC_CHANNELS.ALLOCATIONS_GET, () => {
    return allocationStore.getAllocations()
  })

  ipcMain.handle(IPC_CHANNELS.ALLOCATIONS_SET, (_, allocations: Allocation[]) => {
    allocationStore.setAllocations(allocations)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.ALLOCATIONS_UPSERT, (_, allocation: Allocation) => {
    allocationStore.upsertAllocation(allocation)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.ALLOCATIONS_REMOVE, (_, symbol: string) => {
    allocationStore.removeAllocation(symbol)
    return true
  })

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return allocationStore.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_ACCOUNT, (_, accountId: string) => {
    allocationStore.setSelectedAccountId(accountId)
    return true
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_BUFFER, (_, percent: number) => {
    allocationStore.setBufferPercent(percent)
    return true
  })

  // Auto-invest handlers
  ipcMain.handle(IPC_CHANNELS.AUTOINVEST_ANALYZE, async (_, accountId: string) => {
    return autoinvest.analyzePortfolio(accountId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTOINVEST_PLAN, async (_, accountId: string) => {
    return autoinvest.createAutoInvestPlan(accountId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTOINVEST_EXECUTE, async (_, accountId: string) => {
    return autoinvest.executeAutoInvest(accountId)
  })
}
