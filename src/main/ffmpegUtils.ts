/* eslint-disable prettier/prettier */
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import { DirItem } from '../types'
import { sendToRenderer, logToRenderer } from './index'
import { handleStopAllFFMPEGProcesses } from './ipc'

let totalToConvert: number = 0
let alreadyConverted: number = 0

const resetConversionCount = (): void => {
  console.log('resetting converesion counts')
  totalToConvert = 0
  alreadyConverted = 0
}

const isConversionComplete = (): void => {
  console.log('check if conversion complete')
  if (alreadyConverted === totalToConvert) {
    console.log('conversion is complete calling front')
    sendToRenderer('CONVERSION_COMPLETE')
    resetConversionCount()
  }
}

export const convertExplorer = async (explorer: DirItem[], outputDir: string): Promise<void> => {
  await fs.mkdir(outputDir, { recursive: true }) // Create the parent 'converted' folder in the output path the user chose

  await Promise.allSettled(
    explorer.map(async (dir: DirItem) => {
      if (dir.type === 'folder') {
        const childOutputDir = path.join(outputDir, dir.name) // Create the child folder name
        await fs.mkdir(childOutputDir, { recursive: true }) // Create the new folder in the correct location
        if (dir.children) {
          // Not all folders have children
          // Convert the children as well and create the subfolders if necessary - the nested processing occurs here
          await convertExplorer(dir.children, childOutputDir)
        }
      } else {
        // Convert the actual files and output to the correct folder
        totalToConvert++
        console.log('total is', totalToConvert)
        const fileOutputDir = path.join(outputDir, dir.name)
        switch (dir.ext) {
          case 'audio':
            await convertAudio(dir.path, fileOutputDir)
            break
          case 'video':
            await convertVideo(dir.path, fileOutputDir)
            break
          case 'image':
            await convertImage(dir.path, fileOutputDir)
            break
        }
      }
    })
  )
}

const convertAudio = async (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .outputOptions(['-threads 4', '-q:a 0'])
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
        await handleStopAllFFMPEGProcesses()
        resetConversionCount() // To make sure the values don't persist into next conversion
        sendToRenderer('CONVERSION_ERROR', inputPath, err.message)
        reject(err)
      })
      .on('end', () => {
        sendToRenderer('LIVE_PROGRESS', inputPath, 100) // As mentioned above, this is only to update UI and NOT to track total progress
        alreadyConverted++ // One more file was successfully converted
        isConversionComplete() // Check if they are finally equal
        resolve()
      })
      .run()
  })
}

const convertVideo = async (inputPath: string, outputPath: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const commonOptions = [
        '-c:v', 'libaom-av1',        // Video codec: AV1
        '-c:a', 'libmp3lame',        // Audio codec: MP3  
        '-b:a', '128k',              // Audio bitrate
        '-ar', '44100',              // Audio sample rate
        '-q:a', '0',                 // Audio quality (highest)
        '-crf', '22',                // Video quality (22 = high quality, lower = better)
        '-b:v', '0',                 // Variable bitrate
        '-cpu-used', '4',            // Encoding speed (0=slowest/best, 8=fastest/worst)
        '-row-mt', '1',              // Row-based multithreading (boolean)
        '-tile-columns', '2',        // Split into 4 columns (was 16) - better compression, similar speed
        '-tile-rows', '2',           // Split into 4 rows (was 16) - better compression, similar speed
        '-threads', '4',             // Number of CPU threads
        '-movflags', '+faststart',   // Moves metadata to start of file - no impact on compression
        '-vf', 'scale=\'min(1920,iw):-2:flags=lanczos\''  // Scale video, maintain ratio, max 1920px wide
      ];
      
      ffmpeg(inputPath)
        .outputOptions([...commonOptions, '-pass', '1', '-f', 'null'])
        .output('/dev/null')
        .on('start', () => {
          console.log(`[VIDEO] Starting: ${path.basename(inputPath)}`);
          logToRenderer(`[VIDEO] Starting: ${path.basename(inputPath)}`);
        })
        .on('error', async (err) => {
          await handleStopAllFFMPEGProcesses();
          resetConversionCount();
          sendToRenderer('CONVERSION_ERROR', inputPath, err.message);
          reject(err);
        })
        .on('end', () => {
          console.log('[VIDEO] First pass completed');

          ffmpeg(inputPath)
            .outputOptions([...commonOptions, '-pass', '2'])
            .on('start', () => {
            })
            .on('progress', (progress) => {
              console.log(`[VIDEO] ${path.basename(inputPath)}: ${Math.round(progress.percent)}%`);
              sendToRenderer('LIVE_PROGRESS', inputPath, progress.percent);
            })
            .on('error', async (err) => {
              await handleStopAllFFMPEGProcesses();
              resetConversionCount();
              sendToRenderer('CONVERSION_ERROR', inputPath, err.message);
              reject(err);
            })
            .on('end', () => {
              alreadyConverted++;
              isConversionComplete();
              sendToRenderer('LIVE_PROGRESS', inputPath, 100);
              resolve();
            })
            .save(outputPath.replace(/\.[^/.]+$/, '.mp4'));
        })
        .run();
    });
  }

  const convertImage = async (inputPath: string, outputPath: string): Promise<void> => {
    const avifOutputPath = outputPath.replace(/\.[^/.]+$/, '.avif');
    
    return new Promise((resolve, reject) => {
      const commonOptions = [
        '-c:v', 'libaom-av1',        // Video codec: AV1 for AVIF
        '-crf', '22',                // Quality level (22 = high quality)
        '-cpu-used', '4',            // Encoding speed (2 = good balance)
        '-row-mt', '1',              // Row-based multithreading (boolean)
        '-tile-columns', '2',        // Split into 4 columns (was 16) - better compression
        '-tile-rows', '2',           // Split into 4 rows (was 16) - better compression
        '-threads', '4',             // CPU thread count
        '-vf', 'scale=\'min(1920,iw):-2:flags=lanczos\'',  // Scale image, maintain ratio
        '-f', 'avif'                 // Output format
       ];
          
      ffmpeg(inputPath)
        .outputOptions(commonOptions)
        .on('start', () => {
          console.log(`[IMAGE] Starting: ${path.basename(inputPath)}`);
          logToRenderer(`[IMAGE] Starting: ${path.basename(inputPath)}`);
        })
        .on('error', async (err) => {
          await handleStopAllFFMPEGProcesses();
          resetConversionCount();
          sendToRenderer('CONVERSION_ERROR', inputPath, err.message);
          reject(err);
        })
        .on('end', () => {
          sendToRenderer('LIVE_PROGRESS', inputPath, 100);
          alreadyConverted++;
          isConversionComplete();
          resolve();
        })
        .save(avifOutputPath);
    });
  }
