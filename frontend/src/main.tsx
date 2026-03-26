import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { ScoreboardProvider } from './context/ScoreboardContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScoreboardProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ScoreboardProvider>
  </StrictMode>,
);