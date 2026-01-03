import { app, shell, BrowserWindow, dialog, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { gatewayManager } from './gateway/GatewayManager'
import { registerIpcHandlers } from './ipc/handlers'
import { allocationStore } from './store/AllocationStore'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Initialize the application
async function initialize(): Promise<void> {
  // Accept self-signed certificates for localhost (IBKR gateway)
  session.defaultSession.setCertificateVerifyProc((_request, callback) => {
    callback(0) // Accept all certificates
  })

  // Register IPC handlers
  registerIpcHandlers()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.ibkr-auto-invest')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // First, check if gateway is already running (from previous session or external launch)
  const alreadyRunning = await gatewayManager.checkIfRunning()

  if (!alreadyRunning) {
    // Check if gateway should auto-start
    const shouldAutoStart = allocationStore.getGatewayAutoStart()

    if (shouldAutoStart) {
      // Check Java first before trying to start gateway
      const javaCheck = gatewayManager.detectJava()
      if (!javaCheck.installed) {
        await gatewayManager.showJavaError()
      } else {
        console.log('Starting IBKR Client Portal Gateway...')
        const started = await gatewayManager.start()
        if (!started) {
          dialog.showMessageBox({
            type: 'warning',
            title: 'Gateway Failed to Start',
            message: 'The IBKR Client Portal Gateway failed to start.',
            detail:
              'You can try starting it manually from the Settings page, or check the console for errors.'
          })
        }
      }
    }
  }

  // Create the main window
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(initialize)

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Graceful shutdown - stop the gateway when app quits
let isQuitting = false
app.on('before-quit', async (event) => {
  if (isQuitting) return
  
  if (gatewayManager.getStatus() !== 'stopped') {
    isQuitting = true
    event.preventDefault()
    console.log('Stopping IBKR Gateway...')
    await gatewayManager.stop()
    app.quit()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason)
})
