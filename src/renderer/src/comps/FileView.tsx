import { useState } from 'react'
import { Button } from 'antd'

export default function FileView(): JSX.Element {
  const [dragOverScreen, setDragOverScreen] = useState<boolean>(false)

  // Import files with drag n drop functionality
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy' // Explicitly setting the dropEffect
    setDragOverScreen(true)
  }

  const handleDragLeave = () => {
    setDragOverScreen(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOverScreen(false)
    console.log('drop detected')
    // You can access the dropped files here
    const pathsToDetail = Array.from(e.dataTransfer.files).map((file) => file.path)
    const res = await window.electron.ipcRenderer.invoke('GET_DETAILS', pathsToDetail)
    console.log('res is ', res)
  }

  // Import files with a file explorer window
  const importDirs = async (type: 'folder' | 'file') => {
    console.log(`Importing ${type}`)
    const res = await window.electron.ipcRenderer.invoke('SELECT_DIRS', { type })
    console.log('res is ', res)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="w-full h-[90%] bg-gray-800 border-2 border-gray-700 flex justify-center items-center text-white"
    >
      {dragOverScreen ? (
        <h1 className="text-xl font-bold">Drag over screen enabled</h1>
      ) : (
        <div className="p-[50px] flex justify-center items-center">
          <div className="flex justify-center items-center flex-col">
            <div className="flex flex-row gap-2">
              <Button
                onClick={() => importDirs('folder')}
                className="bg-green-500 text-xl h-[50px] font-bold"
                type="primary"
              >
                Select Folders
              </Button>
              <Button
                onClick={() => importDirs('file')}
                className="bg-green-500 text-xl h-[50px] font-bold"
                type="primary"
              >
                Select Files
              </Button>
            </div>
            <h1 className="text-xl font-bold mt-10">Or Drop your files here</h1>
          </div>
        </div>
      )}
    </div>
  )
}
