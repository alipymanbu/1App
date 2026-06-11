import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { configureDataRootBeforeReady } from './dataRoot'
import { setupIpcHandlers } from './ipc'
import { initDatabase, closeDatabase } from './database'
import { initLogger, info } from './logger'

configureDataRootBeforeReady()
initLogger()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.feedhub')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  info('app', 'db_init', 'Database initialized')

  setupIpcHandlers()
  info('app', 'ipc_ready', 'IPC handlers registered')

  createWindow()
  info('app', 'window_created', 'Main window created')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
  info('app', 'quit', 'App before-quit')
})
