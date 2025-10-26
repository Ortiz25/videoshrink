const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { compressVideo, getCompressionProgress } = require('./compressor');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const uploadsDir = path.join(__dirname, 'uploads');
const outputsDir = path.join(__dirname, 'outputs');

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
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm|flv|wmv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('video/');
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm, flv, wmv)'));
    }
  }
});

const compressionJobs = new Map();

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
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
    const outputPath = path.join(outputsDir, outputFilename);

    compressionJobs.set(jobId, {
      id: jobId,
      status: 'processing',
      progress: 0,
      inputFile: req.file.filename,
      outputFile: outputFilename,
      resolution: resolution,
      startTime: Date.now()
    });

    res.json({
      jobId: jobId,
      message: 'Video upload successful. Compression started.',
      resolution: resolution
    });

    try {
      await compressVideo(inputPath, outputPath, resolution, (progress) => {
        const job = compressionJobs.get(jobId);
        if (job) {
          job.progress = progress;
        }
      });

      const job = compressionJobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.endTime = Date.now();
        
        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(outputPath);
        job.originalSize = inputStats.size;
        job.compressedSize = outputStats.size;
        job.compressionRatio = ((1 - (outputStats.size / inputStats.size)) * 100).toFixed(2);
      }

      fs.unlinkSync(inputPath);

    } catch (error) {
      const job = compressionJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
      }
      
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = compressionJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

app.get('/api/jobs', (req, res) => {
  const jobs = Array.from(compressionJobs.values()).sort((a, b) => b.startTime - a.startTime);
  res.json(jobs);
});

app.get('/api/download/:jobId', (req, res) => {
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
    return res.status(404).json({ error: 'Compressed file not found' });
  }
  
  res.download(filePath, `compressed-video${path.extname(job.outputFile)}`, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
  });
});

app.delete('/api/cleanup/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = compressionJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const filePath = path.join(outputsDir, job.outputFile);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  compressionJobs.delete(jobId);
  res.json({ message: 'Job cleaned up successfully' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video compression server running on http://0.0.0.0:${PORT}`);
  console.log('Ready to compress videos!');
});
