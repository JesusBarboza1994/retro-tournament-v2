import { useState, useEffect, useRef, useCallback } from 'react';

interface UseStreamPlayerOptions {
  wsUrl: string;
}

interface UseStreamPlayerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isConnected: boolean;
  isBuffering: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  stats: {
    bufferedSeconds: number;
    bytesReceived: number;
  };
}

export function useStreamPlayer({ wsUrl }: UseStreamPlayerOptions): UseStreamPlayerReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const queueRef = useRef<ArrayBuffer[]>([]);
  const isAppendingRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ bufferedSeconds: 0, bytesReceived: 0 });

  const bytesReceivedRef = useRef(0);

  const appendNextChunk = useCallback(() => {
    if (!sourceBufferRef.current || isAppendingRef.current || queueRef.current.length === 0) {
      return;
    }

    if (sourceBufferRef.current.updating) {
      return;
    }

    isAppendingRef.current = true;
    const chunk = queueRef.current.shift();

    if (chunk) {
      try {
        sourceBufferRef.current.appendBuffer(chunk);
      } catch (e) {
        console.error('[MSE] Error appending buffer:', e);
        isAppendingRef.current = false;
        // Try to recover by clearing some buffer
        if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
          try {
            const buffered = sourceBufferRef.current.buffered;
            if (buffered.length > 0 && buffered.end(0) - buffered.start(0) > 10) {
              sourceBufferRef.current.remove(buffered.start(0), buffered.start(0) + 5);
            }
          } catch (removeError) {
            console.error('[MSE] Error removing buffer:', removeError);
          }
        }
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
      try {
        mediaSourceRef.current.endOfStream();
      } catch (e) {
        // Ignore
      }
    }

    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    queueRef.current = [];
    isAppendingRef.current = false;
    bytesReceivedRef.current = 0;

    setIsConnected(false);
    setIsBuffering(true);
    setStats({ bufferedSeconds: 0, bytesReceived: 0 });
  }, []);

  const connect = useCallback(() => {
    cleanup();
    setError(null);

    const video = videoRef.current;
    if (!video) {
      setError('Video element not found');
      return;
    }

    // Check MSE support
    if (!('MediaSource' in window)) {
      setError('MediaSource API not supported in this browser');
      return;
    }

    // Create MediaSource
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    video.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', () => {
      console.log('[MSE] MediaSource opened');

      try {
        // WebM with VP8 - best MSE support
        const mimeType = 'video/webm; codecs="vp8"';

        if (!MediaSource.isTypeSupported(mimeType)) {
          setError(`Codec not supported: ${mimeType}`);
          return;
        }

        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        sourceBufferRef.current = sourceBuffer;

        sourceBuffer.mode = 'segments';

        sourceBuffer.addEventListener('updateend', () => {
          isAppendingRef.current = false;

          // Update stats
          if (sourceBuffer.buffered.length > 0) {
            const bufferedSeconds = sourceBuffer.buffered.end(0) - sourceBuffer.buffered.start(0);
            setStats({
              bufferedSeconds,
              bytesReceived: bytesReceivedRef.current
            });

            // Auto-play when we have enough buffer
            if (bufferedSeconds > 0.5 && video.paused) {
              video.play().catch(console.error);
              setIsBuffering(false);
            }
          }

          // Process next chunk in queue
          appendNextChunk();
        });

        sourceBuffer.addEventListener('error', (e) => {
          console.error('[MSE] SourceBuffer error:', e);
        });

        // Connect WebSocket
        console.log('[WS] Connecting to:', wsUrl);
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[WS] Connected');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          const data = event.data as ArrayBuffer;
          bytesReceivedRef.current += data.byteLength;

          // Add to queue
          queueRef.current.push(data);

          // Try to append
          appendNextChunk();
        };

        ws.onerror = (e) => {
          console.error('[WS] Error:', e);
          setError('WebSocket connection error');
        };

        ws.onclose = () => {
          console.log('[WS] Disconnected');
          setIsConnected(false);
        };

      } catch (e) {
        console.error('[MSE] Error setting up:', e);
        setError('Failed to initialize video player');
      }
    });

    mediaSource.addEventListener('sourceended', () => {
      console.log('[MSE] Source ended');
    });

    mediaSource.addEventListener('error', (e) => {
      console.error('[MSE] MediaSource error:', e);
      setError('MediaSource error');
    });

  }, [wsUrl, cleanup, appendNextChunk]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    videoRef,
    isConnected,
    isBuffering,
    error,
    connect,
    disconnect,
    stats
  };
}
