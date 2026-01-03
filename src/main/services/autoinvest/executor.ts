import {
  getAccountLedger,
  getExchangeRate,
  getAllPositions,
  previewOrder,
  placeOrder,
  replyToOrder,
  findConid,
  canAffordOrder,
  OrderRequest
} from '../ibkr'
import { allocationStore } from '../../store/AllocationStore'

export interface PortfolioAnalysis {
  totalValueUSD: number
  cashUSD: number
  cashILS: number
  ilsToUsdRate: number
  positions: PositionAnalysis[]
}

export interface PositionAnalysis {
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

export interface AutoInvestPlan {
  totalAvailableUSD: number
  ilsToConvert: number
  ilsToUsdRate: number
  ordersToPlace: PlannedOrder[]
  summary: string
}

export interface PlannedOrder {
  symbol: string
  conid: number
  shares: number
  estimatedCost: number
  pricePerShare: number
  priority: number
  reason: string
}

export interface AutoInvestResult {
  success: boolean
  ordersPlaced: number
  ordersFailed: number
  totalInvested: number
  results: OrderResult[]
  errors: string[]
}

export interface OrderResult {
  symbol: string
  shares: number
  status: 'success' | 'failed' | 'skipped'
  message: string
  orderId?: string
}

/**
 * Analyze current portfolio against target allocations
 */
export async function analyzePortfolio(accountId: string): Promise<PortfolioAnalysis> {
  // Get ledger for cash balances
  const ledger = await getAccountLedger(accountId)

  // Get current positions
  const positions = await getAllPositions(accountId)

  // Get ILS to USD exchange rate
  let ilsToUsdRate = 0.27 // Default fallback
  try {
    const rateResponse = await getExchangeRate('ILS', 'USD')
    ilsToUsdRate = rateResponse.rate
  } catch (error) {
    console.warn('Could not fetch ILS/USD rate, using default:', error)
  }

  // Extract cash balances
  const cashUSD = ledger['USD']?.cashbalance || 0
  const cashILS = ledger['ILS']?.cashbalance || 0
  const cashILSinUSD = cashILS * ilsToUsdRate

  // Calculate total portfolio value
  const stocksValueUSD = positions.reduce((sum, p) => {
    if (p.currency === 'USD') {
      return sum + p.mktValue
    }
    // Convert other currencies if needed
    return sum + p.mktValue
  }, 0)

  const totalValueUSD = stocksValueUSD + cashUSD + cashILSinUSD

  // Get target allocations
  const allocations = allocationStore.getAllocations()

  // Analyze each position against targets
  const positionAnalysis: PositionAnalysis[] = []

  for (const allocation of allocations) {
    const position = positions.find(
      (p) => p.ticker?.toUpperCase() === allocation.symbol.toUpperCase()
    )

    const currentValueUSD = position?.mktValue || 0
    const currentShares = position?.position || 0
    const pricePerShare = position?.mktPrice || 0
    const currentPercent = totalValueUSD > 0 ? (currentValueUSD / totalValueUSD) * 100 : 0
    const targetPercent = allocation.targetPercent
    const deviationPercent = targetPercent - currentPercent

    // Calculate shares to buy to reach target
    const targetValueUSD = (targetPercent / 100) * totalValueUSD
    const valueNeededUSD = targetValueUSD - currentValueUSD
    const sharesToBuy =
      pricePerShare > 0 ? Math.floor(valueNeededUSD / pricePerShare) : 0

    positionAnalysis.push({
      symbol: allocation.symbol,
      conid: allocation.conid || position?.conid || 0,
      currentShares,
      currentValueUSD,
      currentPercent,
      targetPercent,
      deviationPercent,
      sharesToBuy: Math.max(0, sharesToBuy),
      estimatedCostUSD: Math.max(0, sharesToBuy) * pricePerShare,
      pricePerShare
    })
  }

  return {
    totalValueUSD,
    cashUSD,
    cashILS,
    ilsToUsdRate,
    positions: positionAnalysis
  }
}

/**
 * Create an auto-invest plan based on available cash
 */
export async function createAutoInvestPlan(accountId: string): Promise<AutoInvestPlan> {
  const analysis = await analyzePortfolio(accountId)
  const bufferPercent = allocationStore.getBufferPercent()

  // Calculate available cash (with buffer)
  const ilsToConvert = analysis.cashILS
  const totalCashUSD = analysis.cashUSD + ilsToConvert * analysis.ilsToUsdRate
  const buffer = totalCashUSD * bufferPercent
  const availableUSD = totalCashUSD - buffer

  if (availableUSD <= 0) {
    return {
      totalAvailableUSD: 0,
      ilsToConvert,
      ilsToUsdRate: analysis.ilsToUsdRate,
      ordersToPlace: [],
      summary: 'No cash available for investment after applying safety buffer.'
    }
  }

  // Sort positions by deviation (most underweight first)
  const underweightPositions = analysis.positions
    .filter((p) => p.deviationPercent > 0 && p.sharesToBuy > 0 && p.pricePerShare > 0)
    .sort((a, b) => b.deviationPercent - a.deviationPercent)

  const ordersToPlace: PlannedOrder[] = []
  let remainingCash = availableUSD

  // Prioritize: try to get at least one position to target before moving to next
  for (let i = 0; i < underweightPositions.length; i++) {
    const position = underweightPositions[i]

    if (remainingCash < position.pricePerShare) {
      continue // Not enough for even 1 share
    }

    // Calculate how many shares we can afford
    const maxSharesAffordable = Math.floor(remainingCash / position.pricePerShare)
    const sharesToReachTarget = position.sharesToBuy

    // Try to fully allocate to this position first
    let sharesToBuy: number
    let reason: string

    if (maxSharesAffordable >= sharesToReachTarget) {
      // Can reach target for this position
      sharesToBuy = sharesToReachTarget
      reason = `Reaching target allocation of ${position.targetPercent}%`
    } else {
      // Can only partially fill - buy what we can
      sharesToBuy = maxSharesAffordable
      reason = `Partial fill (${((sharesToBuy * position.pricePerShare) / position.estimatedCostUSD * 100).toFixed(1)}% of needed)`
    }

    if (sharesToBuy > 0) {
      const cost = sharesToBuy * position.pricePerShare

      // Lookup conid if not cached
      let conid = position.conid
      if (!conid) {
        conid = (await findConid(position.symbol)) || 0
      }

      if (conid) {
        ordersToPlace.push({
          symbol: position.symbol,
          conid,
          shares: sharesToBuy,
          estimatedCost: cost,
          pricePerShare: position.pricePerShare,
          priority: i + 1,
          reason
        })

        remainingCash -= cost
      }
    }

    // If we've allocated most of the cash, stop
    if (remainingCash < 10) break
  }

  const totalToInvest = ordersToPlace.reduce((sum, o) => sum + o.estimatedCost, 0)

  return {
    totalAvailableUSD: availableUSD,
    ilsToConvert,
    ilsToUsdRate: analysis.ilsToUsdRate,
    ordersToPlace,
    summary:
      ordersToPlace.length > 0
        ? `Planning to invest $${totalToInvest.toFixed(2)} across ${ordersToPlace.length} positions.`
        : 'No orders to place - all positions are at or above target allocation.'
  }
}

/**
 * Execute the auto-invest plan
 */
export async function executeAutoInvest(accountId: string): Promise<AutoInvestResult> {
  const plan = await createAutoInvestPlan(accountId)
  const bufferPercent = allocationStore.getBufferPercent()

  const results: OrderResult[] = []
  const errors: string[] = []
  let ordersPlaced = 0
  let ordersFailed = 0
  let totalInvested = 0

  // First, convert ILS to USD if we have ILS
  if (plan.ilsToConvert > 100) {
    // Only convert if > 100 ILS
    try {
      // Note: Currency conversion needs special handling via forex orders
      // For now, we'll skip this and document that user should convert manually
      console.log(`Would convert ${plan.ilsToConvert} ILS to USD`)
    } catch (error) {
      errors.push(`Failed to convert ILS to USD: ${error}`)
    }
  }

  // Execute each order
  for (const plannedOrder of plan.ordersToPlace) {
    try {
      const order: OrderRequest = {
        conid: plannedOrder.conid,
        orderType: 'MKT',
        side: 'BUY',
        quantity: plannedOrder.shares,
        tif: 'DAY',
        outsideRTH: false
      }

      // Preview the order first
      const preview = await previewOrder(accountId, [order])
      const affordCheck = canAffordOrder(preview, bufferPercent)

      if (!affordCheck.canAfford) {
        results.push({
          symbol: plannedOrder.symbol,
          shares: plannedOrder.shares,
          status: 'skipped',
          message: affordCheck.reason || 'Insufficient funds'
        })
        continue
      }

      // Place the order
      const orderResponse = await placeOrder(accountId, [order])

      // Handle order confirmation if needed
      if (Array.isArray(orderResponse) && orderResponse.length > 0) {
        const firstResponse = orderResponse[0]

        if ('id' in firstResponse && firstResponse.message) {
          // Need to confirm the order
          const confirmResponse = await replyToOrder(firstResponse.id, true)
          
          if (Array.isArray(confirmResponse) && confirmResponse.length > 0) {
            const confirmed = confirmResponse[0]
            if ('order_id' in confirmed) {
              results.push({
                symbol: plannedOrder.symbol,
                shares: plannedOrder.shares,
                status: 'success',
                message: `Order placed successfully`,
                orderId: confirmed.order_id
              })
              ordersPlaced++
              totalInvested += plannedOrder.estimatedCost
            }
          }
        } else if ('order_id' in firstResponse) {
          // Order placed directly
          results.push({
            symbol: plannedOrder.symbol,
            shares: plannedOrder.shares,
            status: 'success',
            message: 'Order placed successfully',
            orderId: firstResponse.order_id
          })
          ordersPlaced++
          totalInvested += plannedOrder.estimatedCost
        }
      }
    } catch (error) {
      ordersFailed++
      results.push({
        symbol: plannedOrder.symbol,
        shares: plannedOrder.shares,
        status: 'failed',
        message: String(error)
      })
      errors.push(`Failed to place order for ${plannedOrder.symbol}: ${error}`)
    }
  }

  return {
    success: ordersFailed === 0 && ordersPlaced > 0,
    ordersPlaced,
    ordersFailed,
    totalInvested,
    results,
    errors
  }
}
