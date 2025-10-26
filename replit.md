# Video Compressor Application

## Overview
A production-ready Node.js server application for high-quality video compression optimized for social media platforms. Uses FFmpeg with CRF (Constant Rate Factor) encoding to maintain visual quality while reducing file size.

## Purpose
- Compress videos for social media platforms without quality loss
- Support 720p, 1080p, and original resolution presets
- Provide a modern web interface for uploading and downloading compressed videos
- Fast upload speeds with separate compression workflow
- Production-ready with comprehensive error handling and monitoring

## Recent Changes
- 2025-10-26: Initial project setup with Node.js, Express, and FFmpeg
- 2025-10-26: Configured video compression with H.264 codec and quality presets
- 2025-10-26: Enhanced UI with modern glassmorphism design and upload progress bar
- 2025-10-26: Separated upload and compression workflow for faster uploads
- 2025-10-26: Added comprehensive error handling, validation, and health monitoring
- 2025-10-26: Implemented production-ready features (rate limiting, auto-cleanup, logging)

## Project Architecture

### Tech Stack
- **Backend**: Node.js 20 with Express.js
- **Video Processing**: FFmpeg via fluent-ffmpeg library
- **File Handling**: Multer for multipart uploads
- **Frontend**: Modern HTML/CSS/JavaScript with glassmorphism design

### Directory Structure
- `/uploads` - Temporary storage for uploaded videos (auto-cleaned after compression)
- `/outputs` - Compressed video output files (auto-cleaned after 24 hours)
- `/public` - Static files for web interface
- `server.js` - Main Express server with API endpoints
- `compressor.js` - FFmpeg compression service with quality presets

### API Endpoints
- `POST /api/upload` - Upload video file (fast, no compression)
- `POST /api/compress/:id` - Start compression for uploaded video
- `GET /api/jobs` - List all compression jobs
- `GET /api/status/:id` - Get status of specific job
- `GET /api/download/:id` - Download compressed video
- `DELETE /api/cleanup/:id` - Delete job and associated files
- `GET /api/health` - Health check and system status

### Key Features
1. **Separated Upload/Compression Workflow**
   - Fast uploads without blocking on compression
   - Users click "Start Converting" button to begin compression
   - Upload progress bar shows real-time upload status

2. **Video Compression**
   - FFmpeg-based compression with H.264 codec
   - Quality presets: 720p HD, 1080p Full HD, Original resolution
   - CRF 23 for near-lossless quality
   - Real-time compression progress tracking

3. **Production-Ready Features**
   - Comprehensive error handling and validation
   - Rate limiting (max 3 concurrent compressions)
   - Automatic cleanup of old files (24 hour retention)
   - Health monitoring endpoint
   - Detailed logging with job IDs
   - File size limits (500 MB maximum)
   - Cache-Control headers to prevent caching issues

4. **Modern User Interface**
   - Glassmorphism design with gradient backgrounds
   - Smooth animations and hover effects
   - Real-time upload progress bar
   - Toast notifications for user feedback
   - Status indicators (uploaded, processing, completed, failed)
   - Compression statistics (original size, compressed size, space saved)
   - Responsive design for mobile and desktop

5. **Security & Validation**
   - File type validation (video files only)
   - File size enforcement
   - Input sanitization
   - Error messages don't expose system internals

## Compression Settings
- **720p HD**: 1280x720, CRF 23, H.264 codec, 2.5 Mbps video bitrate, 128 kbps audio
- **1080p Full HD**: 1920x1080, CRF 23, H.264 codec, 5 Mbps video bitrate, 192 kbps audio
- **Original**: Keep original resolution, CRF 23, H.264 codec, 192 kbps audio
- **Quality**: Near-lossless compression optimized for social media platforms

## Operational Guide

### System Limits
- Maximum file size: 500 MB
- Maximum concurrent compressions: 3
- Automatic cleanup: Files older than 24 hours

### Monitoring
- Health check endpoint: `GET /api/health`
- Returns: uptime, active jobs, memory usage, file counts

### File Lifecycle
1. Upload: Video saved to `/uploads` directory
2. Compression: Video processed and saved to `/outputs` directory
3. Original file deleted after successful compression
4. Compressed file available for download
5. Automatic cleanup after 24 hours

### Logs
- All operations logged with job IDs
- Compression statistics (size reduction, processing time)
- Error messages with context
- Auto-cleanup activity

## User Preferences
None documented yet.
