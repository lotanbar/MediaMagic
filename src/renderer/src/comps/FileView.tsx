import { useState, Fragment } from 'react'
import { Button, notification } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons';
import { DirItem } from '../../../types'
import { FaTrash, FaChevronDown, FaChevronRight } from 'react-icons/fa'

export default function FileView(): JSX.Element {
  const [dragOverScreen, setDragOverScreen] = useState<boolean>(false)
  const [explorer, setExplorer] = useState<DirItem[]>([])

  // Config 'no children' notification
  const showEmptyFolderNotification = () => {
    notification.info({
      message: 'Empty Folder',
      description: 'This folder does not contain any items.',
      icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      placement: 'topRight',
      duration: 3,
    });
  };

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
    console.log('drop detected')
    const pathsToDetail = Array.from(e.dataTransfer.files).map((file) => file.path)
    const res = await window.electron.ipcRenderer.invoke('GET_DETAILS', pathsToDetail)

    setExplorer(res)
  }

  const importDirs = async (type: 'folder' | 'file'): Promise<void> => {
    console.log(`Importing ${type}`)
    const res = await window.electron.ipcRenderer.invoke('SELECT_DIRS', { type })

    setExplorer(res)
  }

  // Those function are quite complex. I won't lie, I mostly used Claude for those, which is why I made sure to place descriptive comments
  const expandFolder = (index: number, depth: number): void => {
    setExplorer((prevExplorer) => {
      // Main function to update the explorer structure
      const updateExplorer = (items: DirItem[], currentDepth: number): DirItem[] => {
        return items.map((item, i) => {
          if (i === index && currentDepth === depth) {
            if (!item.children || item.children.length === 0) {
              showEmptyFolderNotification();
              return item; // Don't toggle if empty
            }
            const newIsExpanded = !item.isExpanded
            return {
              ...item,
              isExpanded: newIsExpanded,
              // If expanding, keep children as is. If collapsing, collapse all subfolders
              children: newIsExpanded ? item.children : collapseAll(item.children)
            }
          }
          if (item.children) {
            return { ...item, children: updateExplorer(item.children, currentDepth + 1) }
          }
          return item
        })
      }

      // Helper function to recursively collapse all subfolders
      const collapseAll = (items: DirItem[] | undefined): DirItem[] | undefined => {
        return items?.map((item) => ({
          ...item,
          isExpanded: false,
          children: collapseAll(item.children)
        }))
      }

      // Start the update process from the top level
      return updateExplorer(prevExplorer, 0)
    })
  }

  const deleteItem = (index: number, depth: number): void => {
    setExplorer((prevExplorer) => {
      // Recursive function to update the explorer structure
      const updateExplorer = (items: DirItem[], currentDepth: number): DirItem[] => {
        return items.filter((item, i) => {
          // If this is the item to delete, remove it by returning false
          if (i === index && currentDepth === depth) {
            return false
          }
          // If item has children, recursively update them
          if (item.children) {
            item.children = updateExplorer(item.children, currentDepth + 1)
          }
          // Keep all other items
          return true
        })
      }

      // Start the update process from the top level
      return updateExplorer(prevExplorer, 0)
    })
  }

  const renderDirItems = (items: DirItem[], depth: number = 0): JSX.Element[] => {
    return items.map((dir: DirItem, index: number) => (
      <Fragment key={`${depth}-${index}`}>
        <tr className="border-b border-gray-700 hover:bg-gray-800">
          <td className="p-3 w-24 text-lg">
            <div className="flex items-center justify-between">
              {dir.type === 'folder' && dir.children ? (
                <Button
                  onClick={() => expandFolder(index, depth)}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded"
                >
                  {dir.isExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
                </Button>
              ) : (
                <div className="w-8"></div> // Placeholder for alignment
              )}
              <Button
                onClick={() => deleteItem(index, depth)}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded"
              >
                <FaTrash size={14} />
              </Button>
            </div>
          </td>
          <td className="p-3 text-lg">
            <div style={{ paddingLeft: `${depth * 20}px` }} className="flex items-center">
              {dir.type === 'folder' ? (
                <span className="mr-2 text-yellow-500">📁</span>
              ) : (
                <span className="mr-2 text-blue-500">📄</span>
              )}
              {dir.name}
            </div>
          </td>
          <td className="p-3 text-lg">{dir.size}</td>
          <td className="p-3 text-lg">{dir.duration || '-'}</td>
        </tr>
        {dir.children && dir.isExpanded && renderDirItems(dir.children, depth + 1)}
      </Fragment>
    ))
  }

  return (
    <div className="bg-gray-900 text-gray-100 h-[92%] p-6">
      {explorer.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full h-full border-2 ${
            dragOverScreen
              ? 'border-dashed border-blue-400 bg-gray-800'
              : 'border-solid border-gray-700'
          } rounded-lg flex justify-center items-center transition-all duration-300`}
        >
          {dragOverScreen ? (
            <h1 className="text-2xl font-bold text-blue-400">Drop files here</h1>
          ) : (
            <div className="text-center">
              <div className="flex justify-center space-x-4 mb-6">
                <Button
                  onClick={() => importDirs('folder')}
                  className="bg-blue-600 hover:bg-blue-700 transition-colors duration-700 text-white text-lg font-bold px-5 py-4 rounded"
                >
                  Select Folders
                </Button>
                <Button
                  onClick={() => importDirs('file')}
                  className="bg-green-600 hover:bg-green-700 transition-colors duration-700 text-white text-lg font-bold px-5 py-4 rounded"
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
              <th className="p-3 w-24 text-lg"></th> {/* Actions column */}
              <th className="p-3 text-lg">Name</th>
              <th className="p-3 text-lg">Size</th>
              <th className="p-3 text-lg">Duration</th>
            </tr>
          </thead>
          <tbody>{renderDirItems(explorer)}</tbody>
        </table>
      )}
    </div>
  )
}
