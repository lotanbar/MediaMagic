import path from 'path'
import { getVideoDurationInSeconds } from 'get-video-duration'
import { ext } from '../types'

// This is another core func - Heavy commenting could greatly improve the dev xp
export const isValidExt = (filePath: string): ext => {
  // Gets extension from path and processes it:
  // 1. path.extname() returns '.mp4' for example
  // 2. toLowerCase() converts to lowercase
  // 3. slice(1) removes the dot
  const ext = path.extname(filePath).toLowerCase().slice(1)
  // Leaving a single string 'mp4' in this case

  // video/image/audio return value is considered true by the handleDetails conditional, null is considered false
  const validExt = {
    video: ['mp4', 'mkv', 'mov', 'avi', 'webm'],
    audio: ['mp3', 'wav', 'flac', 'ogg', 'opus'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tif', 'tiff']
  } as const

  // Now check if the extension is valid:
  // - Object.entries converts object to array of [key, value] pairs
  // - Type assertion tells TypeScript these are [ext, readonly string[]] pairs
  for (const [group, extensions] of Object.entries(validExt) as [ext, readonly string[]][]) {
    // If the extension exists in current group's array
    if (extensions.includes(ext)) {
      // Return the group name ('video', 'audio', or 'image')
      return group
    }
  }

  // If no match found, return null
  return null
}

export const getDuration = async (filePath: string): Promise<string> => {
  try {
    const seconds = await getVideoDurationInSeconds(filePath)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    return [hours, minutes, remainingSeconds].map((v) => v.toString().padStart(2, '0')).join(':')
  } catch (err) {
    console.error('err in getDuration in fileUtils.ts', err)
    throw err
  }
}
