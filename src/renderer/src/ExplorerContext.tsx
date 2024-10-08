import React, { createContext, useState, useContext } from 'react'
import { DirItem, ExplorerContextType } from '../../types'
import { notification } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'

const ExplorerContext = createContext<ExplorerContextType | undefined>(undefined)

export const ExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [explorer, setExplorer] = useState<DirItem[]>([])

  // Config 'no children' notification
  const showEmptyFolderNotification = (): void => {
    notification.info({
      message: 'Empty Folder',
      description: 'This folder does not contain any items.',
      icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      placement: 'topRight',
      duration: 10
    })
  }

  // Those function are quite complex. I won't lie, I mostly used Claude for those, which is why I made sure to place descriptive comments
  const expandFolder = (index: number, depth: number): void => {
    setExplorer((prevExplorer) => {
      // Main function to update the explorer structure
      const updateExplorer = (items: DirItem[], currentDepth: number): DirItem[] => {
        return items.map((item, i) => {
          if (i === index && currentDepth === depth) {
            if (!item.children || item.children.length === 0) {
              showEmptyFolderNotification()
              return item // Don't toggle if empty
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

      // Start the update process from the top level
      return updateExplorer(prevExplorer, 0)
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

  return (
    <ExplorerContext.Provider value={{ explorer, setExplorer, expandFolder, deleteItem }}>
      {children}
    </ExplorerContext.Provider>
  )
}

export const useExplorer = (): ExplorerContextType => {
  const context = useContext(ExplorerContext)
  if (!context) {
    throw new Error('useExplorer must be used within a ExplorerProvider')
  }
  return context
}
