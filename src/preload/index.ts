import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// IPC Channel names (must match main process)
const IPC_CHANNELS = {
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

  // Allocations
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

// IBKR API exposed to renderer
const ibkrAPI = {
  // Gateway
  gateway: {
    start: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.GATEWAY_START),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.GATEWAY_STOP),
    getStatus: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.GATEWAY_STATUS),
    openLogin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.GATEWAY_OPEN_LOGIN)
  },

  // Auth
  auth: {
    getStatus: (): Promise<{
      authenticated: boolean
      competing: boolean
      connected: boolean
      message: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS)
  },

  // Accounts
  accounts: {
    list: (): Promise<{
      accounts: string[]
      aliases: Record<string, string>
      selectedAccount: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_LIST),
    getLedger: (accountId: string): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_LEDGER, accountId),
    getSummary: (accountId: string): Promise<Record<string, { value: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_SUMMARY, accountId),
    getExchangeRate: (source: string, target: string): Promise<{ rate: number }> =>
      ipcRenderer.invoke(IPC_CHANNELS.ACCOUNTS_EXCHANGE_RATE, source, target)
  },

  // Portfolio
  portfolio: {
    getPositions: (accountId: string): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_POSITIONS, accountId),
    invalidateCache: (accountId: string): Promise<{ message: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PORTFOLIO_INVALIDATE, accountId)
  },

  // Orders
  orders: {
    preview: (accountId: string, orders: unknown[]): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.ORDERS_PREVIEW, accountId, orders),
    place: (accountId: string, orders: unknown[]): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.ORDERS_PLACE, accountId, orders),
    getLive: (): Promise<{ orders: unknown[]; snapshot: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.ORDERS_LIVE),
    cancel: (accountId: string, orderId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.ORDERS_CANCEL, accountId, orderId)
  },

  // Securities
  secdef: {
    search: (symbol: string): Promise<unknown[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.SECDEF_SEARCH, symbol),
    getInfo: (conid: number): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.SECDEF_INFO, conid)
  },

  // Allocations (local storage)
  allocations: {
    get: (): Promise<Array<{ symbol: string; targetPercent: number; conid?: number }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.ALLOCATIONS_GET),
    set: (
      allocations: Array<{ symbol: string; targetPercent: number; conid?: number }>
    ): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.ALLOCATIONS_SET, allocations),
    upsert: (allocation: {
      symbol: string
      targetPercent: number
      conid?: number
    }): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.ALLOCATIONS_UPSERT, allocation),
    remove: (symbol: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.ALLOCATIONS_REMOVE, symbol)
  },

  // Settings
  settings: {
    get: (): Promise<{
      allocations: Array<{ symbol: string; targetPercent: number; conid?: number }>
      bufferPercent: number
      lastUpdated: string
      selectedAccountId: string
      gatewayAutoStart: boolean
    }> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    setAccount: (accountId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_ACCOUNT, accountId),
    setBuffer: (percent: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_BUFFER, percent)
  },

  // Auto-invest
  autoInvest: {
    analyze: (accountId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOINVEST_ANALYZE, accountId),
    createPlan: (accountId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOINVEST_PLAN, accountId),
    execute: (accountId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTOINVEST_EXECUTE, accountId)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('ibkr', ibkrAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.ibkr = ibkrAPI
}
