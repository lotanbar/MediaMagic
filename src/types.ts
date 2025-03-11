import React from 'react'

export type DirItem = {
  path: string
  name: string
  type: 'file' | 'folder'
  ext?: 'video' | 'audio' | 'image'
  size: string
  duration?: string
  children?: DirItem[]
  isExpanded?: boolean
  progress?: number
}

export type ExplorerContextType = {
  explorer: DirItem[]
  setExplorer: React.Dispatch<React.SetStateAction<DirItem[]>>
  convertClicked: boolean
  setConvertClicked: React.Dispatch<React.SetStateAction<boolean>>
  expandFolder: (size: string, index: number, depth: number) => void
  deleteItem: (size: string, index: number, depth: number) => void
}

export type ext = 'video' | 'audio' | 'image' | null | undefined

export type ConversionQueue = {
  type: ext
  inputPath: string
  outputPath: string
}
