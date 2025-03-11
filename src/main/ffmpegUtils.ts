/* eslint-disable prettier/prettier */
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import os from 'os'
import { DirItem, ConversionQueue } from '../types'
import { sendToRenderer, logToRenderer } from './index'
import { handleStopAllFFMPEGProcesses } from './ipc'

const calculateThreads = (): number => {
  const totalThreads = os.cpus().length
  return Math.floor(totalThreads * 0.4) // 6 threads to each worker total 12 threads 4 left for other activities
}

let activeConversions = 0;
const MAX_CONCURRENT = 2; 
const conversionQueue: ConversionQueue[]  = [];

let totalToConvert: number = 0
let alreadyConverted: number = 0
let parentOutputDir: string

const resetConversionCount = (): void => {
  totalToConvert = 0
  alreadyConverted = 0
}

const isConversionComplete = (): void => {
  if (alreadyConverted === totalToConvert) {
    console.log('Conversion is complete')
    sendToRenderer('CONVERSION_COMPLETE')
    resetConversionCount()
  }
}

export const convertExplorer = async (explorer: DirItem[], outputDir: string): Promise<void> => {
  parentOutputDir = outputDir;
  await fs.mkdir(outputDir, { recursive: true });
  
  // First pass: build queue without starting conversions
  const buildQueue = async (items: DirItem[], currentDir: string): Promise<void> => {
    for (const dir of items) {
      if (dir.type === 'folder') {
        const childDir = path.join(currentDir, dir.name);
        await fs.mkdir(childDir, { recursive: true });
        if (dir.children) {
          await buildQueue(dir.children, childDir);
        }
      } else {
        totalToConvert++;
        const fileOutputDir = path.join(currentDir, dir.name);
        // Add to queue instead of converting immediately
        conversionQueue.push({
          type: dir.ext,
          inputPath: dir.path,
          outputPath: fileOutputDir
        });
      }
    }
  };
  
  await buildQueue(explorer, outputDir);
  
  // Start processing with controlled concurrency
  for (let i = 0; i < MAX_CONCURRENT; i++) { // Run loop only set amount of times to assure a constant amount of workers
    processNextInQueue();
  }
};

// New function to process queue items
const processNextInQueue = async (): Promise<void> => {
  // STEP 1: Check if queue is empty
  if (conversionQueue.length === 0) {
    // No more items to process
    if (activeConversions === 0) {
      // Everything is done, notify completion
      isConversionComplete();
    }
    return;
  }
  
  // STEP 2: Check if we're at capacity
  if (activeConversions >= MAX_CONCURRENT) {
    // Already at maximum concurrent conversions
    return;
  }
  
  // STEP 3: Get next file and start processing
  const item = conversionQueue.shift();
  // Add this check to handle undefined
  if (!item) {
    return;
  }

  activeConversions++;
  
  try {
    // STEP 4: Convert the file
    switch (item.type) {
      case 'audio':
        await convertAudio(item.inputPath, item.outputPath);
        break;
      case 'video':
        await convertVideo(item.inputPath, item.outputPath);
        break;
      case 'image':
        await convertImage(item.inputPath, item.outputPath);
        break;
    }
  } catch (err) {
    // There is no reject for conversion functions since errors are handled by ffmpeg
  } finally {
    // STEP 5: Update counters
    activeConversions--;
    alreadyConverted++;
    
    // STEP 6: Process next item
    processNextInQueue();
  }
};

const convertAudio = async (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(44100)
      .outputOptions([`-threads ${calculateThreads()}`, '-q:a 0'])
      .output(outputPath.replace(/\.[^/.]+$/, '.mp3'))
      .on('start', () => {
        console.log(`[AUDIO] Starting: ${path.basename(inputPath)}`)
        logToRenderer(`[AUDIO] Starting: ${path.basename(inputPath)}`)
      })
      .on('progress', (progress) => {
        console.log(`[AUDIO] ${path.basename(inputPath)}: ${Math.round(progress.percent)}%`)
        sendToRenderer('LIVE_PROGRESS', inputPath, progress.percent)
      })
      .on('error', async (err) => {
        console.error('error occured', err)
        await handleStopAllFFMPEGProcesses(parentOutputDir)
        resetConversionCount() // To make sure the values don't persist into next conversion
        sendToRenderer('CONVERSION_ERROR', inputPath, err.message)
        reject(err)
      })
      .on('end', () => {
        sendToRenderer('LIVE_PROGRESS', inputPath, 100) // As mentioned above, this is only to update UI and NOT to track total progress
        isConversionComplete() // Check if they are finally equal
        resolve()
      })
      .run()
  })
}

const convertVideo = async (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // SVT-AV1 specific parameters
    const svtParams = ['tune=0', 'film-grain=15', 'enable-overlays=1', 'enable-qm=1'].join(':')

    const commonOptions = [
      // Video codec and settings
      '-c:v',
      'libsvtav1',
      '-crf',
      '22',
      '-b:v',
      '0',
      '-preset',
      '2',
      '-pix_fmt',
      'yuv420p10le',
      '-svtav1-params',
      svtParams,

      // Audio codec and settings
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      '-ar',
      '44100',
      '-q:a',
      '0',
      '-ac',
      '1',

      // Other settings
      '-threads',
      calculateThreads().toString(),
      '-movflags',
      '+faststart',
      '-vf',
      "scale='min(1920,iw):-2:flags=lanczos'"
    ]
    ffmpeg(inputPath)
      .outputOptions([...commonOptions, '-pass', '1', '-f', 'null'])
      .output('/dev/null')
      .on('start', () => {
        console.log(`[VIDEO] Starting: ${path.basename(inputPath)}`)
        logToRenderer(`[VIDEO] Starting: ${path.basename(inputPath)}`)
      })
      .on('error', async (err) => {
        await handleStopAllFFMPEGProcesses(parentOutputDir)
        resetConversionCount()
        sendToRenderer('CONVERSION_ERROR', inputPath, err.message)
        reject(err)
      })
      .on('stderr', (stderrLine) => {
        console.log(`[VIDEO-STDERR] ${stderrLine}`)
      })
      .on('end', () => {
        console.log('[VIDEO] First pass completed')

        ffmpeg(inputPath)
          .outputOptions([...commonOptions, '-pass', '2'])
          .on('start', () => {})
          .on('progress', (progress) => {
            console.log(`[VIDEO] ${path.basename(inputPath)}: ${Math.round(progress.percent)}%`)
            sendToRenderer('LIVE_PROGRESS', inputPath, progress.percent)
          })
          .on('error', async (err) => {
            await handleStopAllFFMPEGProcesses(parentOutputDir)
            resetConversionCount()
            sendToRenderer('CONVERSION_ERROR', inputPath, err.message)
            reject(err)
          })
          .on('end', () => {
            isConversionComplete()
            sendToRenderer('LIVE_PROGRESS', inputPath, 100)
            resolve()
          })
          .save(outputPath.replace(/\.[^/.]+$/, '.mp4'))
      })
      .run()
  })
}

const convertImage = async (inputPath: string, outputPath: string): Promise<void> => {
  const avifOutputPath = outputPath.replace(/\.[^/.]+$/, '.avif')

  return new Promise((resolve, reject) => {
    // SVT-AV1 specific parameters
    const svtParams = ['film-grain=15'].join(':')

    const commonOptions = [
      // Video codec and settings
      '-c:v',
      'libsvtav1',
      '-crf',
      '22',
      '-preset',
      '2',
      '-pix_fmt',
      'yuv420p10le',
      '-svtav1-params',
      svtParams,

      // Other settings
      '-threads',
      calculateThreads().toString(),
      '-vf',
      "scale='min(1920,iw):-2:flags=lanczos'",
      '-f',
      'avif'
    ]

    ffmpeg(inputPath)
      .outputOptions([...commonOptions, '-pass', '1', '-f', 'null'])
      .output('/dev/null')
      .on('start', () => {
        console.log(`[IMAGE] Starting: ${path.basename(inputPath)}`)
        logToRenderer(`[IMAGE] Starting: ${path.basename(inputPath)}`)
      })
      .on('stderr', (stderrLine) => {
        console.log(`[IMAGE-STDERR] ${stderrLine}`)
      })
      .on('error', async (err) => {
        await handleStopAllFFMPEGProcesses(parentOutputDir)
        resetConversionCount()
        sendToRenderer('CONVERSION_ERROR', inputPath, err.message)
        reject(err)
      })
      .on('end', () => {
        console.log('[IMAGE] First pass completed')

        ffmpeg(inputPath)
          .outputOptions([...commonOptions, '-pass', '2'])
          .on('error', async (err) => {
            await handleStopAllFFMPEGProcesses(parentOutputDir)
            resetConversionCount()
            sendToRenderer('CONVERSION_ERROR', inputPath, err.message)
            reject(err)
          })
          .on('end', () => {
            sendToRenderer('LIVE_PROGRESS', inputPath, 100)
            isConversionComplete()
            resolve()
          })
          .save(avifOutputPath)
      })
      .run()
  })
}
