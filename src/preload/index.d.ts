import { ElectronAPI } from '@electron-toolkit/preload'

interface GatewayAPI {
  start: () => Promise<boolean>
  stop: () => Promise<void>
  getStatus: () => Promise<'stopped' | 'starting' | 'running' | 'error'>
  openLogin: () => Promise<boolean>
}

interface AuthAPI {
  getStatus: () => Promise<{
    authenticated: boolean
    competing: boolean
    connected: boolean
    message: string
  }>
}

interface AccountsAPI {
  list: () => Promise<{
    accounts: string[]
    aliases: Record<string, string>
    selectedAccount: string
  }>
  getLedger: (accountId: string) => Promise<Record<string, LedgerEntry>>
  getSummary: (accountId: string) => Promise<Record<string, { value: string }>>
  getExchangeRate: (source: string, target: string) => Promise<{ rate: number }>
}

interface LedgerEntry {
  commoditymarketvalue: number
  futuremarketvalue: number
  settledcash: number
  exchangerate: number
  sessionid: number
  cashbalance: number
  corporatebondsmarketvalue: number
  warrantsmarketvalue: number
  netliquidationvalue: number
  interest: number
  unrealizedpnl: number
  stockmarketvalue: number
  moneyfunds: number
  currency: string
  realizedpnl: number
  funds: number
  acctcode: string
  issueroptionsmarketvalue: number
  key: string
  timestamp: number
  severity: number
}

interface Position {
  acctId: string
  conid: number
  contractDesc: string
  position: number
  mktPrice: number
  mktValue: number
  currency: string
  avgCost: number
  avgPrice: number
  realizedPnl: number
  unrealizedPnl: number
  ticker: string | null
  name: string | null
  assetClass: string
}

interface PortfolioAPI {
  getPositions: (accountId: string) => Promise<Position[]>
  invalidateCache: (accountId: string) => Promise<{ message: string }>
}

interface OrderRequest {
  conid: number
  orderType: 'MKT' | 'LMT' | 'STP' | 'STP_LIMIT' | 'MIDPRICE'
  side: 'BUY' | 'SELL'
  quantity?: number
  price?: number
  auxPrice?: number
  tif: 'DAY' | 'GTC' | 'IOC' | 'OPG' | 'FOK' | 'DTC'
  outsideRTH?: boolean
  listingExchange?: string
  isCcyConv?: boolean
  fxQty?: number
}

interface OrdersAPI {
  preview: (accountId: string, orders: OrderRequest[]) => Promise<WhatIfResponse>
  place: (accountId: string, orders: OrderRequest[]) => Promise<unknown>
  getLive: () => Promise<{ orders: unknown[]; snapshot: boolean }>
  cancel: (accountId: string, orderId: string) => Promise<unknown>
}

interface WhatIfResponse {
  amount: { amount: string; commission: string; total: string }
  equity: { current: string; change: string; after: string }
  initial: { current: string; change: string; after: string }
  maintenance: { current: string; change: string; after: string }
  position: { current: string; change: string; after: string }
  warn: string
  error: string
}

interface SecurityDefinition {
  conid: number
  companyHeader: string
  companyName: string
  symbol: string
  description: string
}

interface SecdefAPI {
  search: (symbol: string) => Promise<SecurityDefinition[]>
  getInfo: (conid: number) => Promise<unknown>
}

interface Allocation {
  symbol: string
  targetPercent: number
  conid?: number
}

interface AllocationsAPI {
  get: () => Promise<Allocation[]>
  set: (allocations: Allocation[]) => Promise<boolean>
  upsert: (allocation: Allocation) => Promise<boolean>
  remove: (symbol: string) => Promise<boolean>
}

interface Settings {
  allocations: Allocation[]
  bufferPercent: number
  lastUpdated: string
  selectedAccountId: string
  gatewayAutoStart: boolean
}

interface SettingsAPI {
  get: () => Promise<Settings>
  setAccount: (accountId: string) => Promise<boolean>
  setBuffer: (percent: number) => Promise<boolean>
}

interface PortfolioAnalysis {
  totalValueUSD: number
  cashUSD: number
  cashILS: number
  ilsToUsdRate: number
  positions: PositionAnalysis[]
}

interface PositionAnalysis {
  symbol: string
  conid: number
  currentShares: number
  currentValueUSD: number
  currentPercent: number
  targetPercent: number
  deviationPercent: number
  sharesToBuy: number
  estimatedCostUSD: number
  pricePerShare: number
}

interface AutoInvestPlan {
  totalAvailableUSD: number
  ilsToConvert: number
  ilsToUsdRate: number
  ordersToPlace: PlannedOrder[]
  summary: string
}

interface PlannedOrder {
  symbol: string
  conid: number
  shares: number
  estimatedCost: number
  pricePerShare: number
  priority: number
  reason: string
}

interface AutoInvestResult {
  success: boolean
  ordersPlaced: number
  ordersFailed: number
  totalInvested: number
  results: OrderResult[]
  errors: string[]
}

interface OrderResult {
  symbol: string
  shares: number
  status: 'success' | 'failed' | 'skipped'
  message: string
  orderId?: string
}

interface AutoInvestAPI {
  analyze: (accountId: string) => Promise<PortfolioAnalysis>
  createPlan: (accountId: string) => Promise<AutoInvestPlan>
  execute: (accountId: string) => Promise<AutoInvestResult>
}

interface IBKRAPI {
  gateway: GatewayAPI
  auth: AuthAPI
  accounts: AccountsAPI
  portfolio: PortfolioAPI
  orders: OrdersAPI
  secdef: SecdefAPI
  allocations: AllocationsAPI
  settings: SettingsAPI
  autoInvest: AutoInvestAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    ibkr: IBKRAPI
  }
}

export type {
  IBKRAPI,
  GatewayAPI,
  AuthAPI,
  AccountsAPI,
  PortfolioAPI,
  OrdersAPI,
  SecdefAPI,
  AllocationsAPI,
  SettingsAPI,
  AutoInvestAPI,
  LedgerEntry,
  Position,
  OrderRequest,
  WhatIfResponse,
  SecurityDefinition,
  Allocation,
  Settings,
  PortfolioAnalysis,
  PositionAnalysis,
  AutoInvestPlan,
  PlannedOrder,
  AutoInvestResult,
  OrderResult
}
