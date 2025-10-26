const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const QUALITY_PRESETS = {
  '720p': {
    resolution: '1280x720',
    videoBitrate: '2500k',
    audioBitrate: '128k',
    crf: 23,
    preset: 'medium',
    description: 'HD 720p - Optimized for social media'
  },
  '1080p': {
    resolution: '1920x1080',
    videoBitrate: '5000k',
    audioBitrate: '192k',
    crf: 23,
    preset: 'medium',
    description: 'Full HD 1080p - High quality for social media'
  },
  'original': {
    resolution: null,
    videoBitrate: null,
    audioBitrate: '192k',
    crf: 23,
    preset: 'medium',
    description: 'Original resolution - Quality compression only'
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
        '-level 4.2'
      ]);

    if (preset.resolution) {
      command = command.size(preset.resolution);
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
