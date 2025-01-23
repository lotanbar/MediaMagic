import React, { createContext, useState, useContext } from 'react'
import { DirItem, ExplorerContextType } from '../../types'
import { showEmptyFolderNotification } from './Notifications'

const ExplorerContext = createContext<ExplorerContextType | undefined>(undefined)

export const ExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [explorer, setExplorer] = useState<DirItem[]>([])
  const [convertClicked, setConvertClicked] = useState<boolean>(false)

  // Function to recursively collapse all subfolders and handle null values
  const collapseAll = (items: DirItem[]): DirItem[] => {
    return items.map((item) => {
      if (!item) return item

      return {
        ...item,
        isExpanded: false,
        children: item.children ? collapseAll(item.children) : undefined
      }
    })
  }

  // Since size is unique to each folder - it'll be used to solve the multiple folders openings in cases where there are several
  // folders with the same index within the same dir depth
  // The index represents the location of the specific folder within the dir's depth level, which is represented by 'depth'
  const expandFolder = (size: string, index: number, depth: number): void => {
    console.log('the size of the clicked folder is', size)
    // Place the entire functionality inside the setExplorer to work on the state's content
    setExplorer((prevExplorer: DirItem[]) => {
      // The actual logic to find the correct folder 'Items' equal the entirety/part of prevExplorer
      const updateExplorer = (items: DirItem[], currentDepth: number): DirItem[] => {
        /* The index increases after each iteration - thus presenting the move to the next file/folder in the iteration
           the actual depth level is defined, as mentioned above , by the currentDepth param */
        return items.map((item, i) => {
          /* The line below should technically handle null checks - ideally only the isExpanded values should be modified in 
             this func - the state should remain clean otherwise - thus irrelevant items must be returned.
             What's odd is that undefined/nulls shouldn't exist after the filtering in the backend.
             I'll leave it anyways in case I'm missing something - PERHAPS IT'S A TS THING!?!?
          */
          if (!item) return item

          // If we found the relevant index (the folder's id) within the correct depth level, we may proceed
          if (item.size == size && i === index && currentDepth === depth) {
            // The dir was already filtered in the backend and should now contain media files only - empty folders would be those that didn't have media files at all
            if (!item.children || item.children.length === 0) {
              // The double conditional is for TS purposes
              showEmptyFolderNotification()
              return item // Make sure the inspected item is returned - otherwise it would be removed from the state
            }

            const toggledIsExpanded = !item.isExpanded
            return {
              ...item,
              isExpanded: toggledIsExpanded,
              children: toggledIsExpanded ? item.children : collapseAll(item.children)
            }
          }

          return {
            ...item,
            children: item.children ? updateExplorer(item.children, currentDepth + 1) : undefined
          }
        })
      }

      // Call the updateExplorer func on the entire state and start from dir level 0
      return updateExplorer(prevExplorer, 0)
    })
  }

  // Do the same as done in the expandFolder to avoid double delete - read above
  const deleteItem = (size: string, index: number, depth: number): void => {
    setExplorer((prevExplorer) => {
      // Recursive function to update the explorer structure
      const updateExplorer = (items: DirItem[], currentDepth: number): DirItem[] => {
        return items.filter((item, i) => {
          // If this is the item to delete, remove it by returning false
          if (item.size == size && i === index && currentDepth === depth) {
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
    <ExplorerContext.Provider
      value={{ explorer, setExplorer, convertClicked, setConvertClicked, expandFolder, deleteItem }}
    >
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
