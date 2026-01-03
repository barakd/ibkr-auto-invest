import { spawn, execSync, ChildProcess } from 'child_process'
import { app, dialog } from 'electron'
import path from 'path'
import https from 'https'

const GATEWAY_PORT = 5003
const HEALTH_CHECK_INTERVAL = 60000 // 60 seconds
const STARTUP_TIMEOUT = 30000 // 30 seconds
const STARTUP_POLL_INTERVAL = 1000 // 1 second

export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'error'

export class GatewayManager {
  private process: ChildProcess | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null
  private status: GatewayStatus = 'stopped'
  private onStatusChange?: (status: GatewayStatus) => void

  setStatusCallback(callback: (status: GatewayStatus) => void): void {
    this.onStatusChange = callback
  }

  private setStatus(status: GatewayStatus): void {
    this.status = status
    this.onStatusChange?.(status)
  }

  getStatus(): GatewayStatus {
    return this.status
  }

  /**
   * Check if gateway is already running (e.g., from previous session)
   * and update status accordingly
   */
  async checkIfRunning(): Promise<boolean> {
    const isRunning = await this.checkHealth()
    if (isRunning) {
      console.log('Gateway is already running')
      this.setStatus('running')
      this.startHealthChecks()
      return true
    }
    return false
  }

  /**
   * Detect if Java is installed on the system
   */
  detectJava(): { installed: boolean; version?: string; error?: string } {
    try {
      const output = execSync('java -version 2>&1', { encoding: 'utf8' })
      const versionMatch = output.match(/version "(.+)"/)
      return {
        installed: true,
        version: versionMatch ? versionMatch[1] : 'unknown'
      }
    } catch (error) {
      return {
        installed: false,
        error: 'Java Runtime Environment not found. Please install Java 8 or later.'
      }
    }
  }

  /**
   * Show error dialog for missing Java
   */
  async showJavaError(): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Java Required',
      message: 'Java Runtime Environment (JRE) is required to run the IBKR Gateway.',
      detail:
        'Please install Java 8 or later from:\nhttps://adoptium.net/\n\nAfter installation, restart the application.',
      buttons: ['Download Java', 'Cancel'],
      defaultId: 0
    })

    if (result.response === 0) {
      const { shell } = await import('electron')
      shell.openExternal('https://adoptium.net/')
    }
  }

  /**
   * Get the path to the bundled gateway
   */
  private getGatewayPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'gateway')
    }
    // In development, use app.getAppPath() which points to the project root
    return path.join(app.getAppPath(), 'resources', 'gateway')
  }

  /**
   * Start the Client Portal Gateway
   */
  async start(): Promise<boolean> {
    // Check Java first
    const javaCheck = this.detectJava()
    if (!javaCheck.installed) {
      await this.showJavaError()
      this.setStatus('error')
      return false
    }

    console.log(`Java detected: ${javaCheck.version}`)
    this.setStatus('starting')

    const gatewayPath = this.getGatewayPath()
    const isWindows = process.platform === 'win32'

    const scriptPath = isWindows
      ? path.join(gatewayPath, 'bin', 'run.bat')
      : path.join(gatewayPath, 'bin', 'run.sh')

    // Use relative path from gateway directory - the script expects this format
    const configPath = 'root/conf.yaml'

    console.log(`Starting gateway from: ${gatewayPath}`)
    console.log(`Using config: ${configPath}`)

    try {
      if (isWindows) {
        this.process = spawn('cmd.exe', ['/c', scriptPath, configPath], {
          cwd: gatewayPath,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe']
        })
      } else {
        this.process = spawn(scriptPath, [configPath], {
          cwd: gatewayPath,
          stdio: ['ignore', 'pipe', 'pipe']
        })
      }

      this.process.stdout?.on('data', (data) => {
        console.log(`Gateway: ${data.toString().trim()}`)
      })

      this.process.stderr?.on('data', (data) => {
        console.error(`Gateway Error: ${data.toString().trim()}`)
      })

      this.process.on('error', (err) => {
        console.error('Failed to start gateway:', err)
        this.setStatus('error')
      })

      this.process.on('exit', (code, signal) => {
        console.log(`Gateway exited with code ${code}, signal ${signal}`)
        this.process = null
        this.setStatus('stopped')
        this.stopHealthChecks()
      })

      // Wait for gateway to be ready
      const ready = await this.waitForReady()
      if (ready) {
        this.setStatus('running')
        this.startHealthChecks()
        return true
      } else {
        this.setStatus('error')
        await this.stop()
        return false
      }
    } catch (error) {
      console.error('Error starting gateway:', error)
      this.setStatus('error')
      return false
    }
  }

  /**
   * Poll until gateway is ready
   */
  private async waitForReady(): Promise<boolean> {
    const maxAttempts = STARTUP_TIMEOUT / STARTUP_POLL_INTERVAL
    for (let i = 0; i < maxAttempts; i++) {
      const isReady = await this.checkHealth()
      if (isReady) {
        console.log('Gateway is ready')
        return true
      }
      await this.sleep(STARTUP_POLL_INTERVAL)
    }
    console.error('Gateway failed to start within timeout')
    return false
  }

  /**
   * Check if gateway is healthy by calling auth status
   */
  async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: GATEWAY_PORT,
        path: '/v1/api/iserver/auth/status',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const req = https.request(options, (res) => {
        // Any response (even 4xx) means the gateway is running
        resolve(res.statusCode !== undefined && res.statusCode < 500)
      })

      req.on('error', () => resolve(false))
      req.setTimeout(3000, () => {
        req.destroy()
        resolve(false)
      })
      req.end()
    })
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth()
      if (!healthy && this.status === 'running') {
        console.warn('Gateway health check failed')
        this.setStatus('error')
      }
    }, HEALTH_CHECK_INTERVAL)
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /**
   * Gracefully stop the gateway
   */
  async stop(): Promise<void> {
    this.stopHealthChecks()

    if (!this.process) {
      return
    }

    const proc = this.process

    return new Promise((resolve) => {
      const onExit = (): void => {
        this.process = null
        resolve()
      }

      proc.on('exit', onExit)

      // Try graceful shutdown first
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'])
      } else {
        proc.kill('SIGTERM')
      }

      // Force kill after timeout
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL')
          onExit()
        }
      }, 5000)
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const gatewayManager = new GatewayManager()
