import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ScaleRoot } from './scale';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScaleRoot>
      <App />
    </ScaleRoot>
  </StrictMode>,
);
