import React from 'react'

export type DirItem = {
  isExpanded?: boolean
  name: string
  type: 'file' | 'folder'
  size: string
  duration?: string
  children?: DirItem[]
}

export type ExplorerContextType = {
  explorer: DirItem[]
  setExplorer: React.Dispatch<React.SetStateAction<DirItem[]>>
}
