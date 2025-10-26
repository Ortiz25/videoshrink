# Video Compressor Application

## Overview
A Node.js server application for high-quality video compression optimized for social media platforms. Uses FFmpeg with CRF (Constant Rate Factor) encoding to maintain visual quality while reducing file size.

## Purpose
- Compress videos for social media platforms without quality loss
- Support 720p and 1080p resolutions
- Provide a simple web interface for uploading and downloading compressed videos

## Recent Changes
- 2025-10-26: Initial project setup with Node.js, Express, and FFmpeg
- 2025-10-26: Configured video compression with H.264/H.265 codecs

## Project Architecture

### Tech Stack
- **Backend**: Node.js with Express.js
- **Video Processing**: FFmpeg via fluent-ffmpeg library
- **File Handling**: Multer for uploads
- **Frontend**: Simple HTML/CSS/JavaScript dashboard

### Directory Structure
- `/uploads` - Temporary storage for uploaded videos
- `/outputs` - Compressed video output files
- `/public` - Static files for web interface
- `server.js` - Main Express server
- `compressor.js` - FFmpeg compression logic

### Key Features
1. Video upload with file validation
2. FFmpeg-based compression with quality presets
3. Progress tracking for compression jobs
4. Download endpoint for compressed videos
5. Automatic file cleanup

## Compression Settings
- **720p**: CRF 23, H.264 codec, optimized bitrate
- **1080p**: CRF 23, H.264 codec, optimized bitrate
- **Quality**: Near-lossless compression suitable for social media

## User Preferences
None documented yet.
