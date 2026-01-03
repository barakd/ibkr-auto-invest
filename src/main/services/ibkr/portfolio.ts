import { ibkrRequest } from './client'

export interface Position {
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
  exchs: string | null
  expiry: string | null
  putOrCall: string | null
  multiplier: number | null
  strike: number
  exerciseStyle: string | null
  conExchMap: string[]
  assetClass: string
  undConid: number
  model: string
  time: number
  chineseName: string | null
  allExchanges: string | null
  listingExchange: string | null
  countryCode: string | null
  name: string | null
  lastTradingDay: string | null
  group: string | null
  sector: string | null
  sectorGroup: string | null
  ticker: string | null
  type: string | null
  undComp: string | null
  undSym: string | null
  fullName: string | null
  pageSize: number
  isEventContract: boolean
}

export interface PositionsResponse {
  positions: Position[]
  pageSize: number
  pageId: string
}

/**
 * Get positions for an account
 */
export async function getPositions(accountId: string, pageId: number = 0): Promise<Position[]> {
  return ibkrRequest<Position[]>(`/portfolio/${accountId}/positions/${pageId}`)
}

/**
 * Get all positions for an account (paginated fetch)
 */
export async function getAllPositions(accountId: string): Promise<Position[]> {
  const allPositions: Position[] = []
  let pageId = 0
  let hasMore = true

  while (hasMore) {
    const positions = await getPositions(accountId, pageId)
    if (positions.length === 0) {
      hasMore = false
    } else {
      allPositions.push(...positions)
      pageId++
      // IBKR typically returns max 30 positions per page
      if (positions.length < 30) {
        hasMore = false
      }
    }
  }

  return allPositions
}

/**
 * Invalidate the portfolio cache to get fresh data
 */
export async function invalidateCache(accountId: string): Promise<{ message: string }> {
  return ibkrRequest<{ message: string }>(`/portfolio/${accountId}/positions/invalidate`, {
    method: 'POST'
  })
}
