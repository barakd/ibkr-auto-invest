import { ibkrRequest } from './client'

export interface Account {
  id: string
  accountId: string
  accountVan: string
  accountTitle: string
  displayName: string
  accountAlias: string | null
  accountStatus: number
  currency: string
  type: string
  tradingType: string
  ibEntity: string
  faclient: boolean
  clearingStatus: string
  covestor: boolean
  parent?: {
    mmc: string[]
    accountId: string
    isMParent: boolean
    isMChild: boolean
    isMultiplex: boolean
  }
  desc: string
}

export interface AccountsResponse {
  accounts: string[]
  aliases: Record<string, string>
  selectedAccount: string
  chartPeriods?: Record<string, string[]>
}

export interface LedgerEntry {
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

export interface Ledger {
  [currency: string]: LedgerEntry
}

export interface AccountSummary {
  accountready: { value: string }
  accounttype: { value: string }
  accruedcash: { value: string }
  accruedcash_c: { value: string }
  accruedcash_f: { value: string }
  accruedcash_s: { value: string }
  accrueddividend: { value: string }
  accrueddividend_c: { value: string }
  accrueddividend_f: { value: string }
  accrueddividend_s: { value: string }
  availablefunds: { value: string }
  availablefunds_c: { value: string }
  availablefunds_f: { value: string }
  availablefunds_s: { value: string }
  billable: { value: string }
  billable_c: { value: string }
  billable_f: { value: string }
  billable_s: { value: string }
  buyingpower: { value: string }
  cushion: { value: string }
  daytradesremaining: { value: string }
  daytradesremainingt1: { value: string }
  daytradesremainingt2: { value: string }
  daytradesremainingt3: { value: string }
  daytradesremainingt4: { value: string }
  equitywithloanvalue: { value: string }
  equitywithloanvalue_c: { value: string }
  equitywithloanvalue_f: { value: string }
  equitywithloanvalue_s: { value: string }
  excessliquidity: { value: string }
  excessliquidity_c: { value: string }
  excessliquidity_f: { value: string }
  excessliquidity_s: { value: string }
  fullavailablefunds: { value: string }
  fullavailablefunds_c: { value: string }
  fullavailablefunds_f: { value: string }
  fullavailablefunds_s: { value: string }
  fullexcessliquidity: { value: string }
  fullexcessliquidity_c: { value: string }
  fullexcessliquidity_f: { value: string }
  fullexcessliquidity_s: { value: string }
  fullinitmarginreq: { value: string }
  fullinitmarginreq_c: { value: string }
  fullinitmarginreq_f: { value: string }
  fullinitmarginreq_s: { value: string }
  fullmaintmarginreq: { value: string }
  fullmaintmarginreq_c: { value: string }
  fullmaintmarginreq_f: { value: string }
  fullmaintmarginreq_s: { value: string }
  grosspositionvalue: { value: string }
  grosspositionvalue_c: { value: string }
  grosspositionvalue_s: { value: string }
  guarantee: { value: string }
  guarantee_c: { value: string }
  guarantee_f: { value: string }
  guarantee_s: { value: string }
  highestseverity: { value: string }
  indianstockhaircut: { value: string }
  indianstockhaircut_c: { value: string }
  indianstockhaircut_f: { value: string }
  indianstockhaircut_s: { value: string }
  initmarginreq: { value: string }
  initmarginreq_c: { value: string }
  initmarginreq_f: { value: string }
  initmarginreq_s: { value: string }
  leverage_s: { value: string }
  lookaheadavailablefunds: { value: string }
  lookaheadavailablefunds_c: { value: string }
  lookaheadavailablefunds_f: { value: string }
  lookaheadavailablefunds_s: { value: string }
  lookaheadexcessliquidity: { value: string }
  lookaheadexcessliquidity_c: { value: string }
  lookaheadexcessliquidity_f: { value: string }
  lookaheadexcessliquidity_s: { value: string }
  lookaheadinitmarginreq: { value: string }
  lookaheadinitmarginreq_c: { value: string }
  lookaheadinitmarginreq_f: { value: string }
  lookaheadinitmarginreq_s: { value: string }
  lookaheadmaintmarginreq: { value: string }
  lookaheadmaintmarginreq_c: { value: string }
  lookaheadmaintmarginreq_f: { value: string }
  lookaheadmaintmarginreq_s: { value: string }
  maintmarginreq: { value: string }
  maintmarginreq_c: { value: string }
  maintmarginreq_f: { value: string }
  maintmarginreq_s: { value: string }
  netliquidation: { value: string }
  netliquidation_c: { value: string }
  netliquidation_f: { value: string }
  netliquidation_s: { value: string }
  netliquidationuncertainty: { value: string }
  nlvandmargininreview: { value: string }
  pasharesvalue: { value: string }
  pasharesvalue_c: { value: string }
  pasharesvalue_f: { value: string }
  pasharesvalue_s: { value: string }
  physicalcertificatevalue: { value: string }
  physicalcertificatevalue_c: { value: string }
  physicalcertificatevalue_f: { value: string }
  physicalcertificatevalue_s: { value: string }
  postexpirationexcess: { value: string }
  postexpirationexcess_c: { value: string }
  postexpirationexcess_f: { value: string }
  postexpirationexcess_s: { value: string }
  postexpirationmargin: { value: string }
  postexpirationmargin_c: { value: string }
  postexpirationmargin_f: { value: string }
  postexpirationmargin_s: { value: string }
  previousdayequitywithloanvalue: { value: string }
  previousdayequitywithloanvalue_s: { value: string }
  regtequity: { value: string }
  regtequity_s: { value: string }
  regtmargin: { value: string }
  regtmargin_s: { value: string }
  segmenttitle_c: { value: string }
  segmenttitle_f: { value: string }
  segmenttitle_s: { value: string }
  sma: { value: string }
  sma_s: { value: string }
  totalcashvalue: { value: string }
  totalcashvalue_c: { value: string }
  totalcashvalue_f: { value: string }
  totalcashvalue_s: { value: string }
  totaldebitcardpendingcharges: { value: string }
  totaldebitcardpendingcharges_c: { value: string }
  totaldebitcardpendingcharges_f: { value: string }
  totaldebitcardpendingcharges_s: { value: string }
  tradingtype_f: { value: string }
  tradingtype_s: { value: string }
  [key: string]: { value: string }
}

/**
 * Get list of accounts
 */
export async function getAccounts(): Promise<AccountsResponse> {
  return ibkrRequest<AccountsResponse>('/iserver/accounts')
}

/**
 * Get account ledger (balances by currency)
 */
export async function getAccountLedger(accountId: string): Promise<Ledger> {
  return ibkrRequest<Ledger>(`/portfolio/${accountId}/ledger`)
}

/**
 * Get account summary
 */
export async function getAccountSummary(accountId: string): Promise<AccountSummary> {
  return ibkrRequest<AccountSummary>(`/portfolio/${accountId}/summary`)
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(
  source: string,
  target: string
): Promise<{ rate: number }> {
  return ibkrRequest<{ rate: number }>(`/iserver/exchangerate?source=${source}&target=${target}`)
}
