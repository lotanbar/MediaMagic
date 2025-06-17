import { Button } from 'antd'
import { Fragment } from 'react'
import { FaTrash, FaChevronDown, FaChevronRight } from 'react-icons/fa'
import ProgressIndicator from './ProgressIndicator'
import { useExplorer } from '../ExplorerContext'
import { DirItem } from '../../../types'

export default function RenderDirItems(explorer: DirItem[]): JSX.Element {
  const { expandFolder, deleteItem, convertClicked } = useExplorer()

  const renderDirItems = (items: DirItem[], depth: number = 0): JSX.Element[] => {
    return items.map((dir, index) => (
      <Fragment key={`${depth}-${index}`}>
        <tr className="border-b border-gray-700 hover:bg-gray-800">
          <td className="p-1 w-16 text-lg">
            <div style={{ paddingLeft: `${depth * 10}px` }} className="flex items-center">
              {dir.type === 'folder' && dir.children ? (
                <Button
                  onClick={() => expandFolder(dir.size, index, depth)}
                  className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded"
                >
                  {dir.isExpanded ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
                </Button>
              ) : (
                <div className="w-8"></div> // Placeholder for alignment
              )}
              {!convertClicked && (
                <Button
                  onClick={() => deleteItem(dir.size, index, depth)}
                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded ml-2"
                >
                  <FaTrash size={14} />
                </Button>
              )}
            </div>
          </td>
          <td className="text-lg">
            <div style={{ paddingLeft: `${depth * 10}px` }} className="flex items-center">
              {dir.type === 'folder' ? (
                <span className="mr-2">📁</span>
              ) : dir.ext === 'video' ? (
                <span className="mr-2">🎬</span>
              ) : dir.ext === 'image' ? (
                <span className="mr-2">🖼️</span>
              ) : dir.ext === 'audio' ? (
                <span className="mr-2">🔊</span>
              ) : null}
              {dir.name}
            </div>
          </td>
          <td className="p-3 text-lg">{dir.size}</td>
          <td className="p-3 text-lg">{dir.duration}</td>
          <td className="p-3 text-lg">
            <ProgressIndicator fileType={dir.ext} progress={dir.progress || 0} />
          </td>
        </tr>
        {dir.children && dir.isExpanded && renderDirItems(dir.children, depth + 1)}
      </Fragment>
    ))
  }

  return <>{renderDirItems(explorer)}</>
}
