import React from 'react'

export type DirItem = {
  path: string
  isExpanded?: boolean
  name: string
  type: 'file' | 'folder'
  ext?: ext
  size: string
  duration?: string
  children?: DirItem[]
}

export type ExplorerContextType = {
  explorer: DirItem[]
  setExplorer: React.Dispatch<React.SetStateAction<DirItem[]>>
  expandFolder: (index: number, depth: number) => void
  deleteItem: (index: number, depth: number) => void
}

export type ext = 'video' | 'audio' | 'image' | null
