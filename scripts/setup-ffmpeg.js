#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

const FFMPEG_DIR = path.join(__dirname, '..', 'ffmpeg')
const FFMPEG_BIN_PATH = path.join(
  FFMPEG_DIR,
  'ffmpeg' + (process.platform === 'win32' ? '.exe' : '')
)
const FFPROBE_BIN_PATH = path.join(
  FFMPEG_DIR,
  'ffprobe' + (process.platform === 'win32' ? '.exe' : '')
)

// BtbN FFmpeg builds with SVT-AV1 support - Always available URLs (using static builds to avoid DLL dependencies)
const DOWNLOAD_URLS = {
  win32:
    'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
  linux:
    'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
  darwin:
    'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-macos64-gpl.tar.xz'
}

const downloadFile = function (url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading FFmpeg from: ${url}`)
    const file = fs.createWriteStream(dest)

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          return https
            .get(response.headers.location, (redirectResponse) => {
              redirectResponse.pipe(file)
              file.on('finish', () => {
                file.close()
                console.log('Download completed')
                resolve()
              })
            })
            .on('error', reject)
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log('Download completed')
          resolve()
        })
      })
      .on('error', reject)
  })
}

const extractArchive = function (archivePath, extractDir) {
  console.log('Extracting FFmpeg archive...')

  if (process.platform === 'win32') {
    // Windows ZIP extraction
    try {
      execSync(
        `powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`,
        { stdio: 'inherit' }
      )
    } catch (error) {
      console.error('PowerShell extraction failed, trying alternative method...')
      // Fallback: use built-in Node.js extraction if available
      throw new Error(
        'Archive extraction failed. Please install 7-zip or ensure PowerShell is available.'
      )
    }
  } else {
    // Linux/macOS TAR.XZ extraction
    execSync(`tar -xf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' })
  }
}

const moveBinaries = function (extractDir) {
  console.log('Moving FFmpeg binaries...')

  // Find the extracted directory (usually has timestamp in name)
  const contents = fs.readdirSync(extractDir)
  const ffmpegFolder = contents.find(
    (item) => fs.statSync(path.join(extractDir, item)).isDirectory() && item.includes('ffmpeg')
  )

  if (!ffmpegFolder) {
    throw new Error('Could not find extracted FFmpeg folder')
  }

  const binDir = path.join(extractDir, ffmpegFolder, 'bin')
  const ffmpegSrc = path.join(binDir, 'ffmpeg' + (process.platform === 'win32' ? '.exe' : ''))
  const ffprobeSrc = path.join(binDir, 'ffprobe' + (process.platform === 'win32' ? '.exe' : ''))

  // Move binaries to expected location
  fs.copyFileSync(ffmpegSrc, FFMPEG_BIN_PATH)
  fs.copyFileSync(ffprobeSrc, FFPROBE_BIN_PATH)

  // Make executable on Unix systems
  if (process.platform !== 'win32') {
    fs.chmodSync(FFMPEG_BIN_PATH, 0o755)
    fs.chmodSync(FFPROBE_BIN_PATH, 0o755)
  }

  console.log('FFmpeg binaries installed successfully')
}

const setupFFmpeg = async function () {
  try {
    // Check if FFmpeg already exists and has SVT-AV1 support
    if (fs.existsSync(FFMPEG_BIN_PATH)) {
      try {
        const cmd =
          process.platform === 'win32'
            ? `"${FFMPEG_BIN_PATH}" -encoders 2>nul | findstr libsvtav1`
            : `"${FFMPEG_BIN_PATH}" -encoders 2>/dev/null | grep libsvtav1`
        const output = execSync(cmd, { encoding: 'utf8' })
        if (output.includes('libsvtav1')) {
          console.log('FFmpeg with SVT-AV1 support already installed')
          return
        }
      } catch (error) {
        console.log('Existing FFmpeg does not have SVT-AV1 support, updating...')
      }
    }

    const platform = process.platform
    const downloadUrl = DOWNLOAD_URLS[platform]

    if (!downloadUrl) {
      throw new Error(`Unsupported platform: ${platform}`)
    }

    // Create directories
    fs.mkdirSync(FFMPEG_DIR, { recursive: true })

    // Download archive
    const archiveExt = platform === 'win32' ? '.zip' : '.tar.xz'
    const archivePath = path.join(FFMPEG_DIR, `ffmpeg${archiveExt}`)
    await downloadFile(downloadUrl, archivePath)

    // Extract archive
    const extractDir = path.join(FFMPEG_DIR, 'extract')
    fs.mkdirSync(extractDir, { recursive: true })
    extractArchive(archivePath, extractDir)

    // Move binaries
    moveBinaries(extractDir)

    // Cleanup
    fs.rmSync(archivePath)
    fs.rmSync(extractDir, { recursive: true })

    console.log('FFmpeg with SVT-AV1 support installed successfully!')

    // Verify installation
    try {
      const cmd =
        process.platform === 'win32'
          ? `"${FFMPEG_BIN_PATH}" -encoders 2>nul | findstr libsvtav1`
          : `"${FFMPEG_BIN_PATH}" -encoders 2>/dev/null | grep libsvtav1`
      const testOutput = execSync(cmd, { encoding: 'utf8' })
      if (testOutput.includes('libsvtav1')) {
        console.log('✅ SVT-AV1 encoder confirmed available')
      } else {
        console.log('⚠️  SVT-AV1 encoder not detected')
      }
    } catch (error) {
      console.log('⚠️  Could not verify SVT-AV1 encoder (but installation completed)')
    }
  } catch (error) {
    console.error('FFmpeg setup failed:', error.message)
    process.exit(1)
  }
}

setupFFmpeg()
