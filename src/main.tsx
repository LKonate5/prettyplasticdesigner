import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startAutoHeight } from './embed/autoHeight';
import { loadTextures } from './render/textures';
import type { TextureMap } from './render/textures';
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/600.css';
import '@fontsource/work-sans/700.css';
import './styles/theme.css';
import './styles/global.css';

const root = createRoot(document.getElementById('root')!);

function render(textures: TextureMap) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App initialTextures={textures} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

async function bootstrap() {
  try {
    render(await loadTextures());
  } catch {
    render(new Map());
  }
}

void bootstrap();

// Report height to a host page when embedded in an iframe (no-op otherwise).
startAutoHeight();
