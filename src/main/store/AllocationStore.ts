import ElectronStore from 'electron-store'

// Handle ESM/CJS interop - Store is the constructor
const Store = (ElectronStore as unknown as { default: typeof ElectronStore }).default || ElectronStore
type StoreType<T extends Record<string, unknown>> = InstanceType<typeof ElectronStore<T>>

export interface Allocation {
  symbol: string
  targetPercent: number
  conid?: number
}

export interface AllocationSettings {
  allocations: Allocation[]
  bufferPercent: number
  lastUpdated: string
}

interface StoreSchema extends Record<string, unknown> {
  allocations: Allocation[]
  bufferPercent: number
  lastUpdated: string
  selectedAccountId: string
  gatewayAutoStart: boolean
}

const defaults: StoreSchema = {
  allocations: [],
  bufferPercent: 0.05,
  lastUpdated: '',
  selectedAccountId: '',
  gatewayAutoStart: true
}

class AllocationStore {
  private store: StoreType<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({ defaults })
  }

  /**
   * Get all allocations
   */
  getAllocations(): Allocation[] {
    return this.store.get('allocations', [])
  }

  /**
   * Set allocations (replaces all)
   */
  setAllocations(allocations: Allocation[]): void {
    // Validate that percentages sum to 100 (or less for partial allocation)
    const total = allocations.reduce((sum, a) => sum + a.targetPercent, 0)
    if (total > 100) {
      throw new Error(`Allocation percentages sum to ${total}%, which exceeds 100%`)
    }

    this.store.set('allocations', allocations)
    this.store.set('lastUpdated', new Date().toISOString())
  }

  /**
   * Add or update a single allocation
   */
  upsertAllocation(allocation: Allocation): void {
    const allocations = this.getAllocations()
    const index = allocations.findIndex(
      (a) => a.symbol.toUpperCase() === allocation.symbol.toUpperCase()
    )

    if (index >= 0) {
      allocations[index] = { ...allocations[index], ...allocation }
    } else {
      allocations.push(allocation)
    }

    this.setAllocations(allocations)
  }

  /**
   * Remove an allocation
   */
  removeAllocation(symbol: string): void {
    const allocations = this.getAllocations().filter(
      (a) => a.symbol.toUpperCase() !== symbol.toUpperCase()
    )
    this.setAllocations(allocations)
  }

  /**
   * Get buffer percentage
   */
  getBufferPercent(): number {
    return this.store.get('bufferPercent', 0.05)
  }

  /**
   * Set buffer percentage
   */
  setBufferPercent(percent: number): void {
    if (percent < 0 || percent > 1) {
      throw new Error('Buffer percent must be between 0 and 1')
    }
    this.store.set('bufferPercent', percent)
  }

  /**
   * Get selected account ID
   */
  getSelectedAccountId(): string {
    return this.store.get('selectedAccountId', '')
  }

  /**
   * Set selected account ID
   */
  setSelectedAccountId(accountId: string): void {
    this.store.set('selectedAccountId', accountId)
  }

  /**
   * Get gateway auto-start setting
   */
  getGatewayAutoStart(): boolean {
    return this.store.get('gatewayAutoStart', true)
  }

  /**
   * Set gateway auto-start setting
   */
  setGatewayAutoStart(autoStart: boolean): void {
    this.store.set('gatewayAutoStart', autoStart)
  }

  /**
   * Get all settings
   */
  getSettings(): AllocationSettings & { selectedAccountId: string; gatewayAutoStart: boolean } {
    return {
      allocations: this.getAllocations(),
      bufferPercent: this.getBufferPercent(),
      lastUpdated: this.store.get('lastUpdated', ''),
      selectedAccountId: this.getSelectedAccountId(),
      gatewayAutoStart: this.getGatewayAutoStart()
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.store.clear()
  }
}

export const allocationStore = new AllocationStore()
