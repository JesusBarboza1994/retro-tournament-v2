import { WebSocketServer, WebSocket } from 'ws';
import { ScreenCapture, listCaptureDevices } from './capture/screenCapture.js';

const WS_PORT = 8080;

// Capture settings
const CAPTURE_OPTIONS = {
  screenIndex: '4', // [4] Capture screen 0 - your main screen (Mac)
  fps: 30,
  width: 1280,
  height: 720
};

async function main() {
  // If --list flag is passed, just list devices and exit
  if (process.argv.includes('--list')) {
    console.log('Available capture devices:');
    console.log('==========================');
    const devices = await listCaptureDevices();
    console.log(devices);
    process.exit(0);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║        Retro Tournament - Stream Server (MSE)             ║
╠═══════════════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${WS_PORT}                             ║
║  Capture Settings:                                        ║
║    - Screen Index: ${CAPTURE_OPTIONS.screenIndex}                                      ║
║    - Resolution: ${CAPTURE_OPTIONS.width}x${CAPTURE_OPTIONS.height}                              ║
║    - FPS: ${CAPTURE_OPTIONS.fps}                                            ║
╠═══════════════════════════════════════════════════════════╣
║  Run with --list to see available capture devices         ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Track connected clients
  const clients = new Set<WebSocket>();
  let isCapturing = false;

  // Create screen capture instance
  const screenCapture = new ScreenCapture(CAPTURE_OPTIONS);

  // Handle capture data
  screenCapture.on('data', (chunk: Buffer) => {
    // Broadcast to all connected clients
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(chunk);
      }
    });
  });

  screenCapture.on('error', (error: Error) => {
    console.error('[Server] Capture error:', error.message);
  });

  screenCapture.on('close', (code: number) => {
    console.log('[Server] Capture stopped, code:', code);
    isCapturing = false;
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[Server] Client connected, total:', clients.size + 1);
    clients.add(ws);

    // Start capture if this is the first client
    if (!isCapturing) {
      console.log('[Server] Starting screen capture...');
      screenCapture.start();
      isCapturing = true;
    }

    ws.on('close', () => {
      clients.delete(ws);
      console.log('[Server] Client disconnected, remaining:', clients.size);

      // Stop capture if no clients
      if (clients.size === 0 && isCapturing) {
        console.log('[Server] No clients, stopping capture');
        screenCapture.stop();
        isCapturing = false;
      }
    });

    ws.on('error', (error) => {
      console.error('[Server] WebSocket error:', error.message);
      clients.delete(ws);
    });
  });

  console.log(`[Server] WebSocket server running on ws://localhost:${WS_PORT}`);

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    screenCapture.stop();
    wss.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
