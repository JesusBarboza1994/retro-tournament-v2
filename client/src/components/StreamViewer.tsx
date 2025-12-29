import { useStreamPlayer } from '../hooks/useStreamPlayer';

interface StreamViewerProps {
  wsUrl: string;
}

export function StreamViewer({ wsUrl }: StreamViewerProps) {
  const {
    videoRef,
    isConnected,
    isBuffering,
    error,
    connect,
    disconnect,
    stats
  } = useStreamPlayer({ wsUrl });

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Retro Tournament</h1>
        <div style={styles.statusContainer}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: isConnected ? '#00ff88' : '#888'
            }}
          />
          <span style={styles.statusText}>
            {isConnected ? (isBuffering ? 'Buffering...' : 'Streaming') : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={styles.videoContainer}>
        {!isConnected && (
          <div style={styles.placeholder}>
            <p style={styles.placeholderText}>Stream not connected</p>
            <p style={styles.hint}>Click "Connect" to start viewing</p>
          </div>
        )}
        {isConnected && isBuffering && (
          <div style={styles.bufferingOverlay}>
            <div style={styles.spinner} />
            <p>Buffering...</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            ...styles.video,
            opacity: isConnected && !isBuffering ? 1 : 0.3
          }}
        />
      </div>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      <div style={styles.controls}>
        {!isConnected ? (
          <button onClick={connect} style={styles.button}>
            Connect
          </button>
        ) : (
          <button
            onClick={disconnect}
            style={{ ...styles.button, ...styles.disconnectButton }}
          >
            Disconnect
          </button>
        )}
      </div>

      {isConnected && (
        <div style={styles.stats}>
          <span>Buffer: {stats.bufferedSeconds.toFixed(1)}s</span>
          <span>Received: {formatBytes(stats.bytesReceived)}</span>
        </div>
      )}

      <div style={styles.info}>
        <p>Server: {wsUrl}</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    minHeight: '100vh'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '1280px',
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff'
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%'
  },
  statusText: {
    fontSize: '14px'
  },
  videoContainer: {
    width: '100%',
    maxWidth: '1280px',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  placeholder: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    color: '#666',
    zIndex: 1
  },
  placeholderText: {
    fontSize: '18px',
    marginBottom: '8px'
  },
  hint: {
    fontSize: '14px'
  },
  bufferingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    color: '#fff',
    zIndex: 2
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  },
  error: {
    marginTop: '16px',
    padding: '12px 24px',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    border: '1px solid #ff4444',
    borderRadius: '4px',
    color: '#ff4444'
  },
  controls: {
    marginTop: '20px',
    display: 'flex',
    gap: '12px'
  },
  button: {
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  disconnectButton: {
    backgroundColor: '#dc2626'
  },
  stats: {
    marginTop: '16px',
    display: 'flex',
    gap: '24px',
    fontSize: '14px',
    color: '#888'
  },
  info: {
    marginTop: '20px',
    fontSize: '12px',
    color: '#666'
  }
};
