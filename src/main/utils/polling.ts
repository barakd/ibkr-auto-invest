/**
 * Polling utilities for waiting on async operations
 */

export interface PollOptions {
  /** Maximum time to wait in milliseconds */
  timeoutMs?: number
  /** Interval between polls in milliseconds */
  intervalMs?: number
  /** Called on each poll attempt */
  onPoll?: (attempt: number) => void
}

const DEFAULT_TIMEOUT_MS = 60000 // 1 minute
const DEFAULT_INTERVAL_MS = 2000 // 2 seconds

/**
 * Poll until a condition is met or timeout is reached
 * 
 * @param checkFn - Function that returns true when condition is met, false to continue polling
 * @param options - Polling options
 * @returns Promise that resolves to true if condition was met, false if timeout
 */
export async function pollUntil(
  checkFn: () => Promise<boolean>,
  options: PollOptions = {}
): Promise<boolean> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    intervalMs = DEFAULT_INTERVAL_MS,
    onPoll
  } = options

  const startTime = Date.now()
  let attempt = 0

  while (Date.now() - startTime < timeoutMs) {
    attempt++
    
    if (onPoll) {
      onPoll(attempt)
    }

    try {
      const conditionMet = await checkFn()
      if (conditionMet) {
        return true
      }
    } catch (error) {
      console.warn(`Poll attempt ${attempt} failed:`, error)
      // Continue polling on error
    }

    // Wait before next poll
    await sleep(intervalMs)
  }

  return false
}

/**
 * Poll until a value is returned or timeout is reached
 * 
 * @param fetchFn - Function that returns a value or null/undefined to continue polling
 * @param options - Polling options
 * @returns Promise that resolves to the value or null if timeout
 */
export async function pollForValue<T>(
  fetchFn: () => Promise<T | null | undefined>,
  options: PollOptions = {}
): Promise<T | null> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    intervalMs = DEFAULT_INTERVAL_MS,
    onPoll
  } = options

  const startTime = Date.now()
  let attempt = 0

  while (Date.now() - startTime < timeoutMs) {
    attempt++
    
    if (onPoll) {
      onPoll(attempt)
    }

    try {
      const value = await fetchFn()
      if (value !== null && value !== undefined) {
        return value
      }
    } catch (error) {
      console.warn(`Poll attempt ${attempt} failed:`, error)
      // Continue polling on error
    }

    // Wait before next poll
    await sleep(intervalMs)
  }

  return null
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry
 * @param options - Retry options
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2
  } = options

  let lastError: Error | undefined
  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message)

      if (attempt < maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * backoffMultiplier, maxDelayMs)
      }
    }
  }

  throw lastError || new Error('All retries failed')
}
