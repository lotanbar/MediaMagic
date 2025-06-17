import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    Electron: ElectronAPI
    api: unknown
  }
}
