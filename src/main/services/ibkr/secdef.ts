import { ibkrRequest } from './client'

export interface SecurityDefinition {
  conid: number
  companyHeader: string
  companyName: string
  symbol: string
  description: string
  restricted: string | null
  fop: string | null
  opt: string | null
  war: string | null
  sections: Array<{
    secType: string
    exchange: string
  }>
}

export interface ContractInfo {
  cfi_code: string
  symbol: string
  cusip: string | null
  expiry_full: string | null
  con_id: number
  maturity_date: string | null
  industry: string
  instrument_type: string
  trading_class: string
  valid_exchanges: string
  allow_sell_long: boolean
  is_zero_commission_security: boolean
  local_symbol: string
  classifier: string | null
  currency: string
  text: string
  underlying_con_id: number
  r_t_h: boolean
  multiplier: string
  underlying_issuer: string | null
  contract_month: string
  company_name: string
  smart_available: boolean
  exchange: string
  category: string
}

/**
 * Search for a security by symbol
 */
export async function searchSecurity(symbol: string): Promise<SecurityDefinition[]> {
  return ibkrRequest<SecurityDefinition[]>('/iserver/secdef/search', {
    method: 'POST',
    body: {
      symbol,
      name: true,
      secType: 'STK' // Stocks and ETFs
    }
  })
}

/**
 * Get contract details by conid
 */
export async function getContractInfo(conid: number): Promise<ContractInfo> {
  const response = await ibkrRequest<Record<string, ContractInfo>>(
    `/iserver/contract/${conid}/info`
  )
  return response[String(conid)] || response
}

/**
 * Get multiple contract details
 */
export async function getContractInfoBulk(
  conids: number[]
): Promise<Record<string, ContractInfo>> {
  return ibkrRequest<Record<string, ContractInfo>>(
    `/iserver/secdef/info?conids=${conids.join(',')}`
  )
}

/**
 * Common ETF and Stock contract IDs (for reference/caching)
 * These should be looked up dynamically, but cached after first use
 */
export const COMMON_CONIDS: Record<string, number> = {
  // ETFs
  SPY: 756733, // SPDR S&P 500 ETF
  QQQ: 320227571, // Invesco QQQ Trust
  VTI: 97415584, // Vanguard Total Stock Market ETF
  IVV: 9579970, // iShares Core S&P 500 ETF
  VOO: 97907157, // Vanguard S&P 500 ETF
  VEA: 46048054, // Vanguard FTSE Developed Markets
  VWO: 41939883, // Vanguard FTSE Emerging Markets
  BND: 43645865, // Vanguard Total Bond Market ETF
  VNQ: 27684070, // Vanguard Real Estate ETF
  GLD: 51529211, // SPDR Gold Shares

  // Popular Stocks
  AAPL: 265598, // Apple
  MSFT: 272093, // Microsoft
  GOOGL: 208813719, // Alphabet
  AMZN: 3691937, // Amazon
  NVDA: 4815747, // NVIDIA
  META: 107113386, // Meta
  TSLA: 76792991 // Tesla
}

/**
 * Find conid for a symbol (with cache fallback)
 */
export async function findConid(symbol: string): Promise<number | null> {
  // Check cache first
  const upperSymbol = symbol.toUpperCase()
  if (COMMON_CONIDS[upperSymbol]) {
    return COMMON_CONIDS[upperSymbol]
  }

  // Search for the security
  const results = await searchSecurity(symbol)
  if (results.length === 0) {
    return null
  }

  // Return the first match (usually the most relevant)
  return results[0].conid
}
