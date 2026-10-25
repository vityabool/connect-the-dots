import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import './styles.css';
import './results.css';
import './site.css';
import './a11y.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const app = (
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);

// The public pages are delivered as ready-made HTML (for search engines and fast first paint) and are
// "hydrated" here; every other address starts from an empty page and is rendered by the app.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
