const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// Manually tell fluent-ffmpeg where FFmpeg and FFprobe are located on Windows
const ffmpegPath = "/usr/bin/ffmpeg";
const ffprobePath = "/usr/bin/ffprobe";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);


console.log("✅ FFmpeg configured at:", ffmpegPath);

const QUALITY_PRESETS = {
  '720p': {
    scale: "min(1280\\,iw):min(720\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2",
    maxDimension: 720,
    videoBitrate: '2500k',
    audioBitrate: '128k',
    crf: 23,
    preset: 'medium',
    description: 'HD 720p - Optimized for social media (preserves orientation)'
  },
  '1080p': {
    scale: "min(1920\\,iw):min(1080\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2",
    maxDimension: 1080,
    videoBitrate: '5000k',
    audioBitrate: '192k',
    crf: 23,
    preset: 'medium',
    description: 'Full HD 1080p - High quality for reels/TikTok (preserves orientation)'
  },
  'original': {
    scale: null,
    maxDimension: null,
    videoBitrate: null,
    audioBitrate: '192k',
    crf: 23,
    preset: 'medium',
    description: 'Original resolution - Quality compression only (preserves orientation)'
  }
};

function compressVideo(inputPath, outputPath, resolution = '1080p', onProgress) {
  return new Promise((resolve, reject) => {
    const preset = QUALITY_PRESETS[resolution] || QUALITY_PRESETS['1080p'];
    
    let command = ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate(preset.audioBitrate)
      .outputOptions([
        `-crf ${preset.crf}`,
        `-preset ${preset.preset}`,
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-profile:v high',
        '-level 4.2',
        '-map_metadata 0',
        '-metadata:s:v:0 rotate=0'
      ]);

    // Apply scale filter to preserve aspect ratio and orientation
    if (preset.scale) {
      command = command.videoFilters([
        {
          filter: 'scale',
          options: preset.scale
        }
      ]);
    }

    if (preset.videoBitrate) {
      command = command.videoBitrate(preset.videoBitrate);
    }

    command
      .on('start', (commandLine) => {
        console.log('FFmpeg process started:', commandLine);
      })
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          const percent = Math.min(Math.round(progress.percent), 100);
          onProgress(percent);
          console.log(`Processing: ${percent}% done`);
        }
      })
      .on('end', () => {
        console.log('Compression completed successfully');
        if (onProgress) {
          onProgress(100);
        }
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .save(outputPath);
  });
}

module.exports = {
  compressVideo,
  QUALITY_PRESETS
};
