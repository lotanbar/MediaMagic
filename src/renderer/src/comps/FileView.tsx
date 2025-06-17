import RenderDirItem from './RenderDirItems'
import { useState, useEffect } from 'react'
import { Button } from 'antd'
import { DirItem } from '../../../types'
import { showConversionErrorNotification } from '../Notifications'
import { useExplorer } from '../ExplorerContext'
import { IpcRendererEvent } from 'electron'

export default function FileView(): JSX.Element {
  const [dragOverScreen, setDragOverScreen] = useState<boolean>(false)

  const { explorer, setExplorer } = useExplorer()

  const updateItemProgress = (items: DirItem[], path: string, progress: number): DirItem[] => {
    return items.map((item) => {
      if (item.path === path) {
        return { ...item, progress }
      } else if (item.children) {
        return {
          ...item,
          children: updateItemProgress(item.children, path, progress)
        }
      }
      return item
    })
  }

  useEffect(() => {
    const handleProgressUpdate = (
      _event: IpcRendererEvent,
      inputPath: string,
      latestProgress: number
    ): void => {
      setExplorer((prevExplorer) => updateItemProgress(prevExplorer, inputPath, latestProgress))
    }

    const handleConversionError = (
      _event: IpcRendererEvent,
      inputPath: string,
      errorMessage: string
    ): void => {
      showConversionErrorNotification(inputPath, errorMessage)
    }

    window.Electron.ipcRenderer.on('LIVE_PROGRESS', handleProgressUpdate)
    window.Electron.ipcRenderer.on('CONVERSION_ERROR', handleConversionError)

    return (): void => {
      window.Electron.ipcRenderer.removeListener('LIVE_PROGRESS', handleProgressUpdate)
      window.Electron.ipcRenderer.removeListener('CONVERSION_ERROR', handleConversionError)
    }
  }, [])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy' // Explicitly setting the dropEffect
    setDragOverScreen(true)
  }

  const handleDragLeave = (): void => {
    setDragOverScreen(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>): Promise<void> => {
    e.preventDefault()
    setDragOverScreen(false)
    const pathsToDetail = Array.from(e.dataTransfer.files).map((file) => file.path)
    const res = await window.Electron.ipcRenderer.invoke('GET_DETAILS', pathsToDetail)
    console.log('detiled res is', res)

    setExplorer(res)
  }

  const importDirs = async (type: 'folder' | 'file'): Promise<void> => {
    const res = await window.Electron.ipcRenderer.invoke('SELECT_DIRS', { type })
    console.log('detiled res is', res)

    setExplorer(res)
  }

  return (
    <div className="bg-gray-900 text-gray-100 h-[93%] p-3 overflow-y-auto">
      {explorer.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full h-full border-4 ${
            dragOverScreen
              ? 'border-dashed border-blue-400 bg-gray-800'
              : 'border-solid border-gray-500'
          } rounded-lg flex justify-center items-center transition-all duration-300`}
        >
          {dragOverScreen ? (
            <h1 className="text-2xl font-bold text-blue-400">Drop files here</h1>
          ) : (
            <div className="flex justify-center items-center flex-col">
              <div className="w-[60%] mb-6 text-center">
                <h1 className="text-xl font-bold text-gray-400">
                  Greetings, videos will be converted to AV1, images will be converted to AVIF,
                  audios will be converted to OPUS
                </h1>
              </div>
              <div className="flex justify-center space-x-4 mb-6">
                <Button
                  onClick={() => importDirs('folder')}
                  className="bg-blue-600 duration-500 text-white text-lg font-bold px-5 py-4 rounded"
                >
                  Select Folders
                </Button>
                <Button
                  onClick={() => importDirs('file')}
                  className="bg-blue-600 duration-500 text-white text-lg font-bold px-5 py-4 rounded"
                >
                  Select Files
                </Button>
              </div>
              <h1 className="text-xl font-bold text-gray-400">Or drop your files here</h1>
            </div>
          )}
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-800 text-left">
              <>
                <th className="p-3 w-24 text-lg"></th>
                <th className="p-3 text-lg">Name</th>
                <th className="p-3 text-lg">Size</th>
                <th className="p-3 text-lg">Duration</th>
                <th className="p-3 text-lg">Progress</th>
              </>
            </tr>
          </thead>
          <tbody>
            <RenderDirItem {...explorer} />
          </tbody>
        </table>
      )}
    </div>
  )
}
