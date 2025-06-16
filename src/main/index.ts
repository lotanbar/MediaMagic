import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import ipc from './ipc'
import { handleStopAllFFMPEGProcesses } from './ipc'

// Global state
let ipcInitialized = false // To make sure only one instance is active
let mainWindow: BrowserWindow | null = null

// Utility function for sending IPC messages to renderer from any file without needing to import/check mainWindow
export const sendToRenderer = (channel: string, ...args): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, ...args)
    } catch (error) {
      console.error('Error sending to renderer:', error)
    }
  }
}

export const logToRenderer = (message: string): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Window exists')
    try {
      mainWindow.webContents.executeJavaScript(`console.log("${message}")`)
    } catch (error) {
      console.error('Error logging to renderer:', error)
    }
  } else {
    console.error('Window does NOT exist')
  }
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.maximize()
  mainWindow.removeMenu()

  // Clean up FFmpeg processes on window close
  mainWindow.on('close', async () => {
    try {
      await handleStopAllFFMPEGProcesses()
    } catch (error) {
      if (error instanceof Error && !error.message.includes('not found')) {
        console.error('Error stopping FFmpeg processes:', error)
      }
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow?.webContents.toggleDevTools()
    }
  })

  // Load application
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // App initialization
  app
    .whenReady()
    .then(() => {
      electronApp.setAppUserModelId('com.electron')

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      // Initialize IPC handlers once
      if (!ipcInitialized) {
        ipc()
        ipcInitialized = true
        console.log('IPC handlers initialized successfully')
      } else {
        console.log('IPC handlers already initialized, skipping...')
      }

      // Create window only if none exist
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
        console.log('Main process is ready!')
      } else {
        console.log('Windows already exist, skipping window creation...')
      }

      // Clean up FFmpeg processes before quit
      app.on('before-quit', async () => {
        try {
          await handleStopAllFFMPEGProcesses(undefined)
        } catch (error) {
          if (error instanceof Error && !error.message.includes('not found')) {
            console.error('Error stopping FFmpeg processes:', error)
          }
        }
      })

      // Handle macOS activation
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow()
        }
      })
    })
    .catch((error) => {
      console.error('Error during app initialization:', error)
    })
}

// Handle window closure
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
