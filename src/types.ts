export type DirItem = {
  isExpanded?: boolean
  name: string
  type: 'file' | 'folder'
  size: string
  duration?: string
  children?: DirItem[]
}
