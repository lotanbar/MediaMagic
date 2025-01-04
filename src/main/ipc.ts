import { ipcMain, IpcMainInvokeEvent, dialog } from 'electron'
import { ExecException } from 'child_process'
import { lstat, readdir } from 'fs/promises'
import path, { parse, join } from 'path'
import bytes from 'bytes'
import { getFolderSize } from 'go-get-folder-size'
import { DirItem } from '../types'
import { exec } from 'child_process'
import { promisify } from 'util'
import { isValidExt, getDuration } from './fileUtils'
import { convertExplorer } from './ffmpegUtils'

const execAsync = promisify(exec)
let isIpcInitialized = false

export default function ipc(): void {
  if (isIpcInitialized) {
    console.log('IPC handlers already initialized, skipping...')
    return
  }

  // Clean up any existing handlers
  try {
    ipcMain.removeHandler('SELECT_DIRS')
    ipcMain.removeHandler('GET_DETAILS')
    ipcMain.removeHandler('SELECT_OUTPUT_DIR')
    ipcMain.removeHandler('CONVERT_EXPLORER')
    ipcMain.removeHandler('STOP_ALL_FFMPEG_PROCESSES')
  } catch (error) {
    // Ignore errors from removing non-existent handlers
  }

  // Register handlers
  ipcMain.handle('SELECT_DIRS', handleSelectDirs)
  ipcMain.handle('GET_DETAILS', handleGetDetails)
  ipcMain.handle('SELECT_OUTPUT_DIR', handleSelectOutputDir)
  ipcMain.handle('CONVERT_EXPLORER', handleConvertExplorer)
  ipcMain.handle('STOP_ALL_FFMPEG_PROCESSES', handleStopAllFFMPEGProcesses)

  isIpcInitialized = true
  console.log('IPC handlers initialized successfully')
}

// This is the app's core function - I'll add heavy commenting
const handleGetDetails = async (
  _e: IpcMainInvokeEvent | null,
  pathsToDetail: string[]
): Promise<DirItem[]> => {
  const res = await Promise.allSettled<DirItem | undefined>(
    pathsToDetail.map(async (path: string) => {
      try {
        console.log('Processing path:', path)
        const stats = await lstat(path) // Is file or folder

        if (stats.isDirectory()) {
          // If folder
          const childNames = await readdir(path) // readdir gets the paths of the children items
          const children = await Promise.all(
            // Then we get the DirItem(s) of the children - the process might be repeated nested
            childNames.map(async (childName: string) => {
              return await handleGetDetails(null, [join(path, childName)]) // Refer to DirItem type structure to understand the return value
            })
          )

          // After running the func above many times, we should have a nested structure like below - with children under children under children etc
          // This is where we sign the final version of the detailedFolder, all children will have similar props
          const detailedFolder: DirItem = {
            path,
            isExpanded: false,
            name: parse(path).base, // gets the last item in the path - c:/documents/hailmary => hailmary
            type: 'folder',
            size: bytes(await getFolderSize(path)), // bytes() formats the size in bytes we get from getFolderSize
            children: children.flat() as DirItem[] // Flattens Promise.all results into single array of items
          }

          return detailedFolder
        }

        if (stats.isFile()) {
          // If that's a file
          const pathExt = isValidExt(path) // Returns 'video'/'image'/'audio' if the ext is valid and null if invalid
          if (pathExt !== null) {
            // If different than null (if valid)
            const detailedFile: DirItem = {
              path,
              name: parse(path).base,
              type: 'file',
              ext: pathExt,
              size: bytes(stats.size),
              // Calculate duration only if its an audio/video - duration returned is already formatted to hh:mm:ss
              duration: ['video', 'audio'].includes(pathExt!) ? await getDuration(path) : 'none' // Not really sure about the 'cannot be undefined' issue with pathExt, solved it with ! anyways...
            }
            return detailedFile
          }
        }

        return undefined
      } catch (err) {
        if (err instanceof Error) {
          console.error(`Error processing path ${path}:`, err)
          throw new Error(`Error processing path ${path}: ${err.message}`)
        }
        throw new Error(`Error processing path ${path}: Unknown error`)
      }
    })
  )

  const filteredRes = (items: PromiseSettledResult<DirItem | undefined>[]): DirItem[] => {
    return items.reduce((acc: DirItem[], item) => {
      if (item.status === 'fulfilled' && item.value !== undefined) {
        acc.push(item.value)
      }
      return acc
    }, [])
  }

  const result = filteredRes(res)
  console.log('Processing completed, found items:', result.length)
  return result
}

const handleConvertExplorer = async (
  _e: IpcMainInvokeEvent,
  { explorer, outputDir }: { explorer: DirItem[]; outputDir: string }
): Promise<void> => {
  const newOutputDir = path.join(outputDir, 'converted')
  console.log('Output is located in:', newOutputDir)
  await convertExplorer(explorer, newOutputDir)
}

const handleSelectDirs = async (
  _e: IpcMainInvokeEvent,
  { type }: { type: string }
): Promise<DirItem[]> => {
  console.log('Selection type:', type)
  const res = await dialog.showOpenDialog({
    properties:
      type === 'file' ? ['openFile', 'multiSelections'] : ['openDirectory', 'multiSelections']
  })

  if (res.canceled) {
    throw new Error('Selection cancelled by user')
  }

  const pathsToDetail = res.filePaths
  console.log('Selected paths:', pathsToDetail)
  const explorer = await handleGetDetails(null, pathsToDetail)
  return explorer
}

// eslint-disable-next-line
const handleSelectOutputDir = async (_e: IpcMainInvokeEvent): Promise<string> => { 
  console.log('Selecting output directory')
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })

  if (res.canceled) {
    throw new Error('Output directory selection cancelled')
  }

  console.log('Selected output directory:', res.filePaths[0])
  return res.filePaths[0]
}

export const handleStopAllFFMPEGProcesses = async (): Promise<string> => {
  console.log('Stopping all FFmpeg processes')
  const command = process.platform === 'win32' ? 'taskkill /F /IM ffmpeg.exe' : 'pkill -9 ffmpeg'

  try {
    const { stdout, stderr } = await execAsync(command)

    if (stderr && !stderr.includes('not found')) {
      console.error('Error output:', stderr)
      throw new Error(stderr)
    }

    return stdout || 'No FFmpeg processes were running'
  } catch (error) {
    const execError = error as ExecException
    if (execError.message.includes('not found')) {
      return 'No FFmpeg processes were running'
    }
    console.error('Error stopping FFmpeg processes:', execError)
    throw execError
  }
}
