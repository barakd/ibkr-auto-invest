import { ibkrRequest } from './client'

export interface OrderRequest {
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
  referrer?: string
  cOID?: string
}

export interface OrdersSubmitRequest {
  orders: OrderRequest[]
}

export interface WhatIfAmount {
  amount: string
  commission: string
  total: string
}

export interface WhatIfEquity {
  current: string
  change: string
  after: string
}

export interface WhatIfResponse {
  amount: WhatIfAmount
  equity: WhatIfEquity
  initial: WhatIfEquity
  maintenance: WhatIfEquity
  position: WhatIfEquity
  warn: string
  error: string
}

export interface OrderReply {
  order_id: string
  local_order_id: string
  order_status: string
  encrypt_message: string
}

export interface OrderConfirmation {
  id: string
  message: string[]
  isSuppressed?: boolean
  messageIds?: string[]
}

/**
 * Preview an order (whatif) to check if it can be executed
 */
export async function previewOrder(
  accountId: string,
  orders: OrderRequest[]
): Promise<WhatIfResponse> {
  return ibkrRequest<WhatIfResponse>(`/iserver/account/${accountId}/orders/whatif`, {
    method: 'POST',
    body: { orders }
  })
}

/**
 * Place an order
 */
export async function placeOrder(
  accountId: string,
  orders: OrderRequest[]
): Promise<OrderConfirmation[] | OrderReply[]> {
  return ibkrRequest<OrderConfirmation[] | OrderReply[]>(`/iserver/account/${accountId}/orders`, {
    method: 'POST',
    body: { orders }
  })
}

/**
 * Reply to order confirmation (for 2FA or warning acknowledgment)
 */
export async function replyToOrder(
  replyId: string,
  confirmed: boolean
): Promise<OrderConfirmation[] | OrderReply[]> {
  return ibkrRequest<OrderConfirmation[] | OrderReply[]>(`/iserver/reply/${replyId}`, {
    method: 'POST',
    body: { confirmed }
  })
}

/**
 * Get live orders
 */
export async function getLiveOrders(): Promise<{
  orders: Array<{
    acct: string
    conidex: string
    conid: number
    orderId: number
    cashCcy: string
    sizeAndFills: string
    orderDesc: string
    description1: string
    ticker: string
    secType: string
    listingExchange: string
    remainingQuantity: number
    filledQuantity: number
    companyName: string
    status: string
    origOrderType: string
    supportsTaxOpt: string
    lastExecutionTime: string
    orderType: string
    bgColor: string
    fgColor: string
    order_ref: string
    timeInForce: string
    lastExecutionTime_r: number
    side: string
  }>
  snapshot: boolean
}> {
  return ibkrRequest('/iserver/account/orders', { method: 'GET' })
}

/**
 * Cancel an order
 */
export async function cancelOrder(
  accountId: string,
  orderId: string
): Promise<{ msg: string; order_id: number; conid: number; account: string }> {
  return ibkrRequest(`/iserver/account/${accountId}/order/${orderId}`, {
    method: 'DELETE'
  })
}

/**
 * Check if whatif response indicates sufficient funds
 */
export function canAffordOrder(
  whatifResponse: WhatIfResponse,
  bufferPercent: number = 0.05
): {
  canAfford: boolean
  reason?: string
  orderTotal: number
  currentEquity: number
  equityAfter: number
  bufferAmount: number
  commission: number
} {
  // Check for errors
  if (whatifResponse.error) {
    return {
      canAfford: false,
      reason: whatifResponse.error,
      orderTotal: 0,
      currentEquity: 0,
      equityAfter: 0,
      bufferAmount: 0,
      commission: 0
    }
  }

  const orderTotal = parseFloat(whatifResponse.amount.total) || 0
  const currentEquity = parseFloat(whatifResponse.equity.current) || 0
  const equityAfter = parseFloat(whatifResponse.equity.after) || 0
  const commission = parseFloat(whatifResponse.amount.commission) || 0

  // Calculate buffer
  const bufferAmount = currentEquity * bufferPercent
  const minimumEquityRequired = bufferAmount

  // Check if equity after trade is above buffer
  const canAfford = equityAfter >= minimumEquityRequired

  return {
    canAfford,
    reason: canAfford ? undefined : 'Insufficient funds after applying safety buffer',
    orderTotal,
    currentEquity,
    equityAfter,
    bufferAmount,
    commission
  }
}
