import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import { App } from './app/App';
import { createProjectDesktopGateway } from './persistence';
import './styles/tokens.css';
import './styles/main.css';

if (import.meta.env.VITE_MANDALA_E2E === 'true') {
  await import('@wdio/tauri-plugin');
}

const root = document.getElementById('root');

if (!root) {
  throw new Error("Le point de montage #root est introuvable.");
}

createRoot(root).render(
  <StrictMode>
    <App gateway={createProjectDesktopGateway()} />
  </StrictMode>,
);
