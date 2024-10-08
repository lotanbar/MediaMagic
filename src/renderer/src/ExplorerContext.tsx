import React, { createContext, useState, useContext } from 'react'
import { DirItem, ExplorerContextType } from '../../types'

const ExplorerContext = createContext<ExplorerContextType | undefined>(undefined)

export const ExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [explorer, setExplorer] = useState<DirItem[]>([])

  return (
    <ExplorerContext.Provider value={{ explorer, setExplorer }}>
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
