import { ipcMain, IpcMainInvokeEvent } from 'electron'

export default function ipc(): void {
  ipcMain.handle('SELECT_DIRS', handleSelectDirs)
  ipcMain.handle('GET_DETAILS', handleGetDetails)
}

const handleGetDetails = async (e: IpcMainInvokeEvent | null, pathsToDetail: string[]) => {
  console.log('hello from getDetails pathsToDetail are', pathsToDetail)
}

const handleSelectDirs = async (e: IpcMainInvokeEvent, { type }: { type: string }) => {
  console.log('hello from handleSelectDir type is', type)
}
