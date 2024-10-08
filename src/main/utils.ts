import path from 'path'
import { getVideoDurationInSeconds } from 'get-video-duration'
import { DirItem } from '../types'

export function isValidExt(filePath: string): string | null {
  const validExt: Record<string, string[]> = {
    video: ['mp4', 'mkv', 'mov', 'avi', 'webm'],
    audio: ['mp3', 'wav', 'flac', 'ogg', 'opus'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  }
  const ext = path.extname(filePath).toLowerCase().slice(1)

  for (const [group, extensions] of Object.entries(validExt)) {
    if (extensions.includes(ext)) {
      return group
    }
  }

  return null
}

export async function getDuration(filePath: string): Promise<string> {
  try {
    const seconds = await getVideoDurationInSeconds(filePath)

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    const duration = [hours, minutes, remainingSeconds]
      .map((v) => v.toString().padStart(2, '0'))
      .join(':')

    return duration
  } catch (err) {
    console.error('err in getDuration in utils.ts')
    throw err
  }
}

export async function convertExplorer(explorer: DirItem[], outputDir: string) {
  console.log('hello from convertExplorer in utils.ts')
}
