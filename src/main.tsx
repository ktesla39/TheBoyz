import {createRoot} from 'react-dom/client';
import '@fontsource/vt323/latin-400.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/press-start-2p/latin-400.css';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
