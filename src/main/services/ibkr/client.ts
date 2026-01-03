import https from 'https'

const BASE_URL = 'https://localhost:5003/v1/api'

export class IBKRError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'IBKRError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: object
  timeout?: number
}

/**
 * Make an HTTPS request to the IBKR Client Portal API
 * 
 * The gateway maintains its own authenticated session internally.
 * After logging in via the browser, the gateway is authenticated and
 * all requests to localhost:5003 should work without cookies.
 * Follows redirects automatically.
 */
export async function ibkrRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeout = 30000 } = options
  const bodyStr = body ? JSON.stringify(body) : ''

  const makeRequest = (requestUrl: URL, redirectCount: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) {
        reject(new IBKRError(0, 'Too many redirects'))
        return
      }

      const requestOptions: https.RequestOptions = {
        hostname: requestUrl.hostname,
        port: requestUrl.port || (requestUrl.protocol === 'https:' ? 443 : 80),
        path: requestUrl.pathname + requestUrl.search,
        method,
        rejectUnauthorized: false, // Self-signed certificate
        headers: {
          // Required headers per IBKR docs
          'Host': requestUrl.host,
          'User-Agent': 'IBKR-AutoInvest-Electron/1.0',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'Content-Type': 'application/json',
          // Content-Length is required for POST requests
          ...(method === 'POST' || method === 'PUT' ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {})
        }
      }

      console.log(`IBKR ${method} ${requestUrl.href}`)

      const req = https.request(requestOptions, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          const location = res.headers['location']
          console.log(`IBKR ${method} ${endpoint} -> ${res.statusCode}${location ? ` (redirect: ${location})` : ''}`, data.substring(0, 300))
          
          // Follow redirects (301, 302, 303, 307, 308)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location) {
            console.log(`Following redirect to: ${location}`)
            const redirectUrl = new URL(location, requestUrl)
            makeRequest(redirectUrl, redirectCount + 1).then(resolve).catch(reject)
            return
          }
          
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : {}
              resolve(parsed as T)
            } catch {
              resolve(data as T)
            }
          } else {
            reject(new IBKRError(res.statusCode || 500, data || 'Unknown error'))
          }
        })
      })

      req.on('error', (error) => {
        reject(new IBKRError(0, `Network error: ${error.message}`))
      })

      req.setTimeout(timeout, () => {
        req.destroy()
        reject(new IBKRError(0, 'Request timeout'))
      })

      if (bodyStr) {
        req.write(bodyStr)
      }

      req.end()
    })
  }

  // Remove leading slash from endpoint to properly append to BASE_URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  const initialUrl = new URL(cleanEndpoint, BASE_URL + '/')
  return makeRequest(initialUrl, 0)
}

/**
 * Check authentication status
 * Calls /iserver/auth/status directly
 */
export async function getAuthStatus(): Promise<{
  authenticated: boolean
  competing: boolean
  connected: boolean
  message: string
  MAC?: string
  serverInfo?: { serverName: string; serverVersion: string }
}> {
  try {
    console.log('Checking auth status...')
    const result = await ibkrRequest<{
      authenticated: boolean
      competing: boolean
      connected: boolean
      message: string
    }>('/iserver/auth/status', { method: 'POST' })
    console.log('Auth status result:', JSON.stringify(result))
    return result
  } catch (error) {
    console.log('Auth status error:', error)
    // 302 redirect means not authenticated (redirect to login page)
    // 401 means not authenticated
    if (error instanceof IBKRError && (error.statusCode === 302 || error.statusCode === 401)) {
      return {
        authenticated: false,
        competing: false,
        connected: false,
        message: 'Not authenticated'
      }
    }
    throw error
  }
}

/**
 * Initialize the brokerage session
 * According to IBKR docs, this must be called after login to access /iserver endpoints
 */
export async function initBrokerageSession(): Promise<{
  authenticated: boolean
  competing: boolean
  connected: boolean
  message: string
}> {
  return ibkrRequest('/iserver/auth/ssodh/init', {
    method: 'POST',
    body: { publish: true, compete: true }
  })
}

/**
 * Re-authenticate the session
 */
export async function reauthenticate(): Promise<{ message: string }> {
  return ibkrRequest('/iserver/reauthenticate', { method: 'POST' })
}
