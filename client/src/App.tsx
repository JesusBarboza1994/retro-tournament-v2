import { StreamViewer } from './components/StreamViewer';

const WS_URL = 'ws://localhost:8080';

function App() {
  return (
    <StreamViewer wsUrl={WS_URL} />
  );
}

export default App;
