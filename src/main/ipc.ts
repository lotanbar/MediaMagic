import { ipcMain, IpcMainInvokeEvent, dialog } from 'electron'
import { lstat, readdir } from 'fs/promises'
import { isValidExt, getDuration } from './utils'
import { parse, join } from 'path'
import bytes from 'bytes'
import { getFolderSize } from 'go-get-folder-size'

export default function ipc() {
  ipcMain.handle('SELECT_DIRS', handleSelectDirs)
  ipcMain.handle('GET_DETAILS', handleGetDetails)
}

// Accept event and object if the func was called via dnd in front, or pathsToDetail if it was called via handleSelectDir
const handleGetDetails = async (e: IpcMainInvokeEvent | null, pathsToDetail: string[]) => {
  const res = await Promise.allSettled(
    // 1. Check paths type - file/folder
    pathsToDetail.map(async (path: string) => {
      try {
        const stats = await lstat(path)
        if (stats.isDirectory()) {
          const childNames = await readdir(path) // Get children names
          // Recursively get children details
          const children = await Promise.all(
            childNames.map(async (childName: string) => {
              return await handleGetDetails(null, [join(path, childName)])
            })
          )

          // // Get folder size
          // const size = await getFolderSize(path)
          // const real = bytes(await getFolderSize(path))

          const detailedFolder = {
            name: parse(path).name,
            type: 'folder',
            size: bytes(await getFolderSize(path)),
            children: children.flat()
          }

          return detailedFolder
        } else if (stats.isFile()) {
          // 2. Check if the file exension is media
          const pathExt = isValidExt(path)
          if (['video', 'audio', 'image'].includes(pathExt!)) {            
            // 3. Construct a detailed file obj
            const detailedFile = {
              name: parse(path).name,
              type: 'file',
              size: bytes(stats.size),
              duration: ['video', 'audio'].includes(pathExt!) ? await getDuration(path) : 'none'
            }
            return detailedFile
          }
        }
      } catch (err) {
        throw new Error(`Error processing path ${path}: ${err.message}`)
      }
    })
  )

  // Filter status: fullfilled from the result
  const unwrapFulfilled = (item: any): any => {
    if (item && typeof item === 'object') {
      if (item.status === 'fulfilled' && 'value' in item) {
        return unwrapFulfilled(item.value);
      }
      if (Array.isArray(item)) {
        return item.map(unwrapFulfilled);
      }
      return Object.fromEntries(
        Object.entries(item).map(([key, value]) => [key, unwrapFulfilled(value)])
      );
    }
    return item;
  };

  const filteredRes = unwrapFulfilled(res);

  // A logging tecnique, doesn't manipulate the object
  const getCircularReplacer = () => {
    const seen = new WeakSet()
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      return value
    }
  }

  console.log('explorer is', JSON.stringify(filteredRes, getCircularReplacer(), 2))
  return filteredRes
}

async function handleSelectDirs(e: IpcMainInvokeEvent, { type }: { type: string }) {
  console.log('type is', type)
  const res = await dialog.showOpenDialog({
    properties: type === 'file' ? ['openFile', 'multiSelections'] : ['openDirectory']
  })

  if (res.canceled) {
    throw new Error('err in handleSelectDir in ipc.ts')
  } else {
    // Standardize function
    const pathsToDetail = res.filePaths
    const explorer = await handleGetDetails(null, pathsToDetail)

    return explorer
  }
}
