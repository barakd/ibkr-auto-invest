import { ibkrRequest } from './client'
import { placeOrder, replyToOrder, previewOrder, OrderRequest, getLiveOrders } from './orders'
import { pollUntil } from '../../utils/polling'

export interface ForexSearchResult {
  conid: number
  companyHeader?: string
  companyName?: string
  symbol: string
  description?: string
  sections?: Array<{
    secType: string
    exchange: string
  }>
}

export interface ForexConversionResult {
  success: boolean
  orderId?: string
  message: string
  convertedAmount?: number
  filled?: boolean
}

/**
 * Known forex conids for common currency pairs
 * Format: BASE.QUOTE (e.g., USD.ILS means buying USD with ILS)
 */
export const FOREX_CONIDS: Record<string, number> = {
  'USD.ILS': 15016062, // USD/ILS pair - buy USD with ILS
}

/**
 * Search for a forex contract by currency pair
 * @param currencyPair - e.g., "USD.ILS" to convert ILS to USD
 */
export async function searchForexContract(currencyPair: string): Promise<ForexSearchResult[]> {
  return ibkrRequest<ForexSearchResult[]>('/iserver/secdef/search', {
    method: 'POST',
    body: {
      symbol: currencyPair,
      secType: 'CASH'
    }
  })
}

/**
 * Get the conid for a forex pair, with caching
 * @param currencyPair - e.g., "USD.ILS"
 */
export async function getForexConid(currencyPair: string): Promise<number | null> {
  const upperPair = currencyPair.toUpperCase()
  
  // Check cache first
  if (FOREX_CONIDS[upperPair]) {
    return FOREX_CONIDS[upperPair]
  }

  // Search for the forex contract
  try {
    const results = await searchForexContract(currencyPair)
    if (results && results.length > 0) {
      return results[0].conid
    }
  } catch (error) {
    console.error(`Failed to search for forex contract ${currencyPair}:`, error)
  }

  return null
}

/**
 * Convert ILS to USD by placing a forex order
 * 
 * This places a market order to buy USD with ILS.
 * The cashQty parameter specifies the amount of ILS to convert.
 * 
 * @param accountId - The IBKR account ID
 * @param ilsAmount - Amount of ILS to convert to USD
 * @returns Result of the conversion including order ID if successful
 */
export async function convertIlsToUsd(
  accountId: string,
  ilsAmount: number
): Promise<ForexConversionResult> {
  if (ilsAmount <= 0) {
    return {
      success: false,
      message: 'ILS amount must be greater than 0'
    }
  }

  try {
    // Get the conid for USD.ILS pair
    const conid = await getForexConid('USD.ILS')
    
    if (!conid) {
      return {
        success: false,
        message: 'Could not find USD.ILS forex contract'
      }
    }

    console.log(`Found USD.ILS conid: ${conid}`)

    // Create the forex order
    // We're buying USD (the base currency) using ILS (the quote currency)
    // cashQty specifies the amount in the quote currency (ILS) to use
    const forexOrder: OrderRequest = {
      conid,
      orderType: 'MKT',
      side: 'BUY', // Buy USD
      fxQty: ilsAmount, // Amount of ILS to convert
      tif: 'DAY',
      isCcyConv: true // This is a currency conversion
    }

    console.log(`Previewing forex order: ${JSON.stringify(forexOrder)}`)

    // Preview the order first
    try {
      const preview = await previewOrder(accountId, [forexOrder])
      console.log(`Forex order preview:`, preview)
      
      // Check for errors in preview
      if (preview.error) {
        return {
          success: false,
          message: `Order preview failed: ${preview.error}`
        }
      }
    } catch (previewError) {
      console.warn('Preview failed, continuing with order:', previewError)
      // Continue anyway - some forex orders may not support preview
    }

    // Place the order
    console.log(`Placing forex order to convert ${ilsAmount} ILS to USD...`)
    const orderResponse = await placeOrder(accountId, [forexOrder])
    console.log(`Forex order response:`, orderResponse)

    // Handle order confirmations
    if (Array.isArray(orderResponse) && orderResponse.length > 0) {
      const firstResponse = orderResponse[0]

      // Check if we need to confirm the order
      if ('id' in firstResponse && 'message' in firstResponse) {
        console.log(`Confirming forex order: ${firstResponse.message}`)
        const confirmResponse = await replyToOrder(firstResponse.id, true)
        console.log(`Forex order confirmation response:`, confirmResponse)

        if (Array.isArray(confirmResponse) && confirmResponse.length > 0) {
          const confirmed = confirmResponse[0]
          
          // Check if there's another confirmation needed
          if ('id' in confirmed && 'message' in confirmed) {
            console.log(`Second confirmation needed: ${confirmed.message}`)
            const secondConfirm = await replyToOrder(confirmed.id, true)
            console.log(`Second confirmation response:`, secondConfirm)
            
            if (Array.isArray(secondConfirm) && secondConfirm.length > 0) {
              const finalResult = secondConfirm[0]
              if ('order_id' in finalResult) {
                return {
                  success: true,
                  orderId: finalResult.order_id,
                  message: `Currency conversion order placed successfully`,
                  convertedAmount: ilsAmount
                }
              }
            }
          }
          
          if ('order_id' in confirmed) {
            return {
              success: true,
              orderId: confirmed.order_id,
              message: `Currency conversion order placed successfully`,
              convertedAmount: ilsAmount
            }
          }
        }
      }

      // Order placed directly without confirmation
      if ('order_id' in firstResponse) {
        return {
          success: true,
          orderId: firstResponse.order_id,
          message: `Currency conversion order placed successfully`,
          convertedAmount: ilsAmount
        }
      }
    }

    return {
      success: false,
      message: 'Unexpected response from order placement'
    }
  } catch (error) {
    console.error('Currency conversion failed:', error)
    return {
      success: false,
      message: `Currency conversion failed: ${error}`
    }
  }
}

/**
 * Wait for an order to be filled
 * 
 * @param orderId - The order ID to wait for
 * @param timeoutMs - Maximum time to wait (default 60 seconds)
 * @param intervalMs - Polling interval (default 2 seconds)
 * @returns true if order was filled, false if timeout or still pending
 */
export async function waitForOrderFill(
  orderId: string,
  timeoutMs: number = 60000,
  intervalMs: number = 2000
): Promise<{ filled: boolean; status: string }> {
  console.log(`Waiting for order ${orderId} to fill...`)

  const result = await pollUntil(
    async () => {
      try {
        const { orders } = await getLiveOrders()
        
        // Find our order in the list
        const order = orders.find((o) => String(o.orderId) === String(orderId))
        
        if (!order) {
          // Order not in live orders - likely filled or cancelled
          console.log(`Order ${orderId} not found in live orders - assuming filled`)
          return true
        }

        const status = order.status?.toLowerCase() || ''
        console.log(`Order ${orderId} status: ${status}`)

        // Check if filled
        if (status === 'filled') {
          return true
        }

        // Check if cancelled or rejected
        if (status === 'cancelled' || status === 'rejected' || status === 'inactive') {
          console.warn(`Order ${orderId} was ${status}`)
          return true // Stop polling, but we'll check status
        }

        return false
      } catch (error) {
        console.warn(`Error checking order status:`, error)
        return false
      }
    },
    { timeoutMs, intervalMs }
  )

  // Get final status
  try {
    const { orders } = await getLiveOrders()
    const order = orders.find((o) => String(o.orderId) === String(orderId))
    
    if (!order) {
      // Not in live orders means it was filled
      return { filled: true, status: 'filled' }
    }
    
    return { filled: order.status?.toLowerCase() === 'filled', status: order.status || 'unknown' }
  } catch {
    return { filled: result, status: result ? 'filled' : 'unknown' }
  }
}

/**
 * Convert ILS to USD and wait for the order to fill
 * 
 * @param accountId - The IBKR account ID
 * @param ilsAmount - Amount of ILS to convert to USD
 * @param waitForFill - Whether to wait for the order to fill (default true)
 * @param fillTimeoutMs - Maximum time to wait for fill (default 60 seconds)
 * @returns Result of the conversion including fill status
 */
export async function convertIlsToUsdAndWait(
  accountId: string,
  ilsAmount: number,
  waitForFill: boolean = true,
  fillTimeoutMs: number = 60000
): Promise<ForexConversionResult> {
  // First, place the conversion order
  const result = await convertIlsToUsd(accountId, ilsAmount)
  
  if (!result.success || !result.orderId) {
    return result
  }

  // If not waiting for fill, return immediately
  if (!waitForFill) {
    return result
  }

  // Wait for the order to fill
  const fillResult = await waitForOrderFill(result.orderId, fillTimeoutMs)
  
  return {
    ...result,
    filled: fillResult.filled,
    message: fillResult.filled
      ? `Currency conversion completed (${fillResult.status})`
      : `Currency conversion order placed but not yet filled (${fillResult.status})`
  }
}

/**
 * Generic currency conversion function
 * 
 * @param accountId - The IBKR account ID
 * @param fromCurrency - Source currency (e.g., "ILS")
 * @param toCurrency - Target currency (e.g., "USD")
 * @param amount - Amount in source currency to convert
 */
export async function convertCurrency(
  accountId: string,
  fromCurrency: string,
  toCurrency: string,
  amount: number
): Promise<ForexConversionResult> {
  // For ILS to USD, use the specific function
  if (fromCurrency.toUpperCase() === 'ILS' && toCurrency.toUpperCase() === 'USD') {
    return convertIlsToUsd(accountId, amount)
  }

  // For other currency pairs, construct the pair symbol
  const currencyPair = `${toCurrency.toUpperCase()}.${fromCurrency.toUpperCase()}`
  
  try {
    const conid = await getForexConid(currencyPair)
    
    if (!conid) {
      return {
        success: false,
        message: `Could not find forex contract for ${currencyPair}`
      }
    }

    const forexOrder: OrderRequest = {
      conid,
      orderType: 'MKT',
      side: 'BUY',
      fxQty: amount,
      tif: 'DAY',
      isCcyConv: true
    }

    const orderResponse = await placeOrder(accountId, [forexOrder])
    
    if (Array.isArray(orderResponse) && orderResponse.length > 0) {
      const firstResponse = orderResponse[0]
      
      if ('id' in firstResponse && 'message' in firstResponse) {
        const confirmResponse = await replyToOrder(firstResponse.id, true)
        
        if (Array.isArray(confirmResponse) && confirmResponse.length > 0) {
          const confirmed = confirmResponse[0]
          if ('order_id' in confirmed) {
            return {
              success: true,
              orderId: confirmed.order_id,
              message: `Currency conversion order placed successfully`,
              convertedAmount: amount
            }
          }
        }
      }
      
      if ('order_id' in firstResponse) {
        return {
          success: true,
          orderId: firstResponse.order_id,
          message: `Currency conversion order placed successfully`,
          convertedAmount: amount
        }
      }
    }

    return {
      success: false,
      message: 'Unexpected response from order placement'
    }
  } catch (error) {
    console.error('Currency conversion failed:', error)
    return {
      success: false,
      message: `Currency conversion failed: ${error}`
    }
  }
}
