import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface CaptureOptions {
  /** Screen index for avfoundation (Mac) or window title for gdigrab (Windows) */
  screenIndex: string;
  /** Frame rate */
  fps: number;
  /** Video width */
  width: number;
  /** Video height */
  height: number;
  /** Platform: 'darwin' for Mac, 'win32' for Windows */
  platform?: 'darwin' | 'win32';
}

export class ScreenCapture extends EventEmitter {
  private ffmpeg: ChildProcess | null = null;
  private isRunning = false;

  constructor(private options: CaptureOptions) {
    super();
    this.options.platform = this.options.platform || (process.platform as 'darwin' | 'win32');
  }

  start(): void {
    if (this.isRunning) {
      console.log('[ScreenCapture] Already running');
      return;
    }

    const args = this.buildFFmpegArgs();
    console.log('[ScreenCapture] Starting FFmpeg with args:', args.join(' '));

    this.ffmpeg = spawn('ffmpeg', args);
    this.isRunning = true;

    this.ffmpeg.stdout?.on('data', (data: Buffer) => {
      this.emit('data', data);
    });

    this.ffmpeg.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      // Only log important messages, not progress
      if (!message.includes('frame=') && !message.includes('fps=') && !message.includes('speed=')) {
        console.log('[FFmpeg]', message.trim());
      }
    });

    this.ffmpeg.on('close', (code) => {
      console.log(`[ScreenCapture] FFmpeg exited with code ${code}`);
      this.isRunning = false;
      this.emit('close', code);
    });

    this.ffmpeg.on('error', (err) => {
      console.error('[ScreenCapture] FFmpeg error:', err);
      this.isRunning = false;
      this.emit('error', err);
    });
  }

  private buildFFmpegArgs(): string[] {
    const { screenIndex, fps, width, height, platform } = this.options;

    const inputArgs = platform === 'win32'
      ? ['-f', 'gdigrab', '-framerate', fps.toString(), '-i', 'desktop']
      : ['-f', 'avfoundation', '-framerate', fps.toString(), '-capture_cursor', '1', '-i', `${screenIndex}:none`];

    return [
      ...inputArgs,
      // Video encoding - WebM/VP8 for better MSE support
      '-vf', `scale=${width}:${height}`,
      '-c:v', 'libvpx',
      '-quality', 'realtime',
      '-speed', '8',
      '-threads', '4',
      '-pix_fmt', 'yuv420p',
      // Keyframe settings
      '-g', fps.toString(),
      // Bitrate control
      '-b:v', '2500k',
      '-maxrate', '2500k',
      '-bufsize', '500k',
      // Output format - WebM cluster streaming
      '-f', 'webm',
      '-cluster_size_limit', '512k',
      '-cluster_time_limit', '1000',
      '-an', // No audio
      'pipe:1' // Output to stdout
    ];
  }

  stop(): void {
    if (this.ffmpeg) {
      console.log('[ScreenCapture] Stopping FFmpeg');
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
      this.isRunning = false;
    }
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

// Helper to list available capture devices
export async function listCaptureDevices(): Promise<string> {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    const args = platform === 'win32'
      ? ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']
      : ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''];

    const ffmpeg = spawn('ffmpeg', args);
    let output = '';

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    ffmpeg.on('close', () => {
      resolve(output);
    });

    ffmpeg.on('error', reject);
  });
}
