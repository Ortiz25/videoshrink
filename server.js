const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { compressVideo } = require('./compressor');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

// 🧠 Manually set FFmpeg and FFprobe paths for Windows
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');



if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm|flv|wmv|mpeg|mpg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype.startsWith('video/') || allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm, flv, wmv, mpeg, mpg)'));
    }
  }
});

const compressionJobs = new Map();
const MAX_CONCURRENT_JOBS = 3;
let activeJobs = 0;

function getActiveJobsCount() {
  let count = 0;
  for (const job of compressionJobs.values()) {
    if (job.status === 'processing') {
      count++;
    }
  }
  return count;
}

app.post('/api/upload', (req, res) => {
  upload.single('video')(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 500MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded' });
      }

      const { resolution } = req.body;
      
      if (!resolution || !['720p', '1080p', 'original'].includes(resolution)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid resolution. Choose 720p, 1080p, or original' });
      }

      const jobId = Date.now().toString();
      const inputPath = req.file.path;
      const outputFilename = `compressed-${jobId}${path.extname(req.file.filename)}`;
      
      let inputStats;
      try {
        inputStats = fs.statSync(inputPath);
      } catch (error) {
        fs.unlinkSync(inputPath);
        return res.status(500).json({ error: 'Failed to read uploaded file' });
      }

      compressionJobs.set(jobId, {
        id: jobId,
        status: 'uploaded',
        progress: 0,
        inputFile: req.file.originalname,
        inputPath: inputPath,
        outputFile: outputFilename,
        resolution: resolution,
        uploadTime: Date.now(),
        originalSize: inputStats.size
      });

      console.log(`[${jobId}] Video uploaded: ${req.file.originalname} (${(inputStats.size / 1024 / 1024).toFixed(2)} MB)`);

      res.json({
        jobId: jobId,
        message: 'Video uploaded successfully. Ready to compress.',
        resolution: resolution,
        originalSize: inputStats.size,
        fileName: req.file.originalname
      });

    } catch (error) {
      console.error('Upload error:', error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Internal server error during upload' });
    }
  });
});

app.post('/api/compress/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = compressionJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'processing') {
      return res.status(400).json({ error: 'Compression already in progress' });
    }

    if (job.status === 'completed') {
      return res.status(400).json({ error: 'Video already compressed' });
    }

    if (!fs.existsSync(job.inputPath)) {
      compressionJobs.delete(jobId);
      return res.status(404).json({ error: 'Video file not found. It may have been deleted.' });
    }

    const activeCount = getActiveJobsCount();
    if (activeCount >= MAX_CONCURRENT_JOBS) {
      return res.status(429).json({ 
        error: `Server is busy. Maximum ${MAX_CONCURRENT_JOBS} concurrent compressions allowed. Please try again in a moment.`,
        activeJobs: activeCount
      });
    }

    job.status = 'processing';
    job.progress = 0;
    job.startTime = Date.now();
    activeJobs++;

    console.log(`[${jobId}] Compression started: ${job.inputFile} -> ${job.resolution}`);

    res.json({
      jobId: jobId,
      message: 'Compression started',
      status: 'processing'
    });

    const outputPath = path.join(outputsDir, job.outputFile);

    try {
      await compressVideo(job.inputPath, outputPath, job.resolution, (progress) => {
        const currentJob = compressionJobs.get(jobId);
        if (currentJob) {
          currentJob.progress = progress;
        }
      });

      const currentJob = compressionJobs.get(jobId);
      if (currentJob) {
        currentJob.status = 'completed';
        currentJob.progress = 100;
        currentJob.endTime = Date.now();
        
        const outputStats = fs.statSync(outputPath);
        currentJob.compressedSize = outputStats.size;
        currentJob.compressionRatio = ((1 - (outputStats.size / currentJob.originalSize)) * 100).toFixed(2);
        currentJob.processingTime = ((currentJob.endTime - currentJob.startTime) / 1000).toFixed(1);
        
        console.log(`[${jobId}] Compression completed: ${(currentJob.originalSize / 1024 / 1024).toFixed(2)} MB -> ${(currentJob.compressedSize / 1024 / 1024).toFixed(2)} MB (${currentJob.compressionRatio}% saved) in ${currentJob.processingTime}s`);
      }

      if (fs.existsSync(job.inputPath)) {
        fs.unlinkSync(job.inputPath);
      }

      activeJobs--;

    } catch (error) {
      console.error(`[${jobId}] Compression error:`, error.message);
      const currentJob = compressionJobs.get(jobId);
      if (currentJob) {
        currentJob.status = 'failed';
        currentJob.error = 'Compression failed. The video file may be corrupted or in an unsupported format.';
      }
      
      if (fs.existsSync(job.inputPath)) {
        fs.unlinkSync(job.inputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      activeJobs--;
    }

  } catch (error) {
    console.error('Compression endpoint error:', error);
    activeJobs--;
    res.status(500).json({ error: 'Internal server error during compression' });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = compressionJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const jobData = { ...job };
    delete jobData.inputPath;
    
    res.json(jobData);
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
});

app.get('/api/jobs', (req, res) => {
  try {
    const jobs = Array.from(compressionJobs.values())
      .map(job => {
        const jobData = { ...job };
        delete jobData.inputPath;
        return jobData;
      })
      .sort((a, b) => (b.uploadTime || b.startTime) - (a.uploadTime || a.startTime));
    res.json(jobs);
  } catch (error) {
    console.error('Jobs list error:', error);
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

app.get('/api/download/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = compressionJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Video compression not completed yet' });
    }
    
    const filePath = path.join(outputsDir, job.outputFile);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Compressed file not found. It may have been deleted.' });
    }
    
    console.log(`[${jobId}] Download started: ${job.outputFile}`);
    
    res.download(filePath, `compressed-${job.inputFile}`, (err) => {
      if (err && !res.headersSent) {
        console.error(`[${jobId}] Download error:`, err);
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});

app.delete('/api/cleanup/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = compressionJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const outputPath = path.join(outputsDir, job.outputFile);
    
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    if (job.inputPath && fs.existsSync(job.inputPath)) {
      fs.unlinkSync(job.inputPath);
    }
    
    console.log(`[${jobId}] Job cleaned up: ${job.inputFile}`);
    compressionJobs.delete(jobId);
    res.json({ message: 'Job cleaned up successfully' });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup job' });
  }
});

app.get('/api/health', (req, res) => {
  try {
    const uploadsDirSize = fs.readdirSync(uploadsDir).length;
    const outputsDirSize = fs.readdirSync(outputsDir).length;
    const activeCount = getActiveJobsCount();
    
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      jobs: {
        total: compressionJobs.size,
        active: activeCount,
        uploads: uploadsDirSize,
        outputs: outputsDirSize
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

setInterval(() => {
  try {
    const now = Date.now();
    const CLEANUP_AGE = 24 * 60 * 60 * 1000;
    let cleanedCount = 0;
    
    for (const [jobId, job] of compressionJobs.entries()) {
      const jobAge = now - (job.endTime || job.uploadTime || job.startTime);
      
      if (jobAge > CLEANUP_AGE) {
        if (job.inputPath && fs.existsSync(job.inputPath)) {
          fs.unlinkSync(job.inputPath);
        }
        
        const outputPath = path.join(outputsDir, job.outputFile);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        
        compressionJobs.delete(jobId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Auto-cleanup: Removed ${cleanedCount} old job(s)`);
    }
  } catch (error) {
    console.error('Auto-cleanup error:', error);
  }
}, 60 * 60 * 1000);

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log(`🎬 Video Compression Server v1.0`);
  console.log('='.repeat(60));
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsDir}`);
  console.log(`📦 Output directory: ${outputsDir}`);
  console.log(`⚙️  Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
  console.log(`📊 Max file size: 500 MB`);
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log('  POST   /api/upload          - Upload video');
  console.log('  POST   /api/compress/:id    - Start compression');
  console.log('  GET    /api/jobs            - List all jobs');
  console.log('  GET    /api/status/:id      - Get job status');
  console.log('  GET    /api/download/:id    - Download compressed video');
  console.log('  DELETE /api/cleanup/:id     - Delete job');
  console.log('  GET    /api/health          - Health check');
  console.log('='.repeat(60));
  console.log('✅ Ready to compress videos!');
  console.log('='.repeat(60));
});
