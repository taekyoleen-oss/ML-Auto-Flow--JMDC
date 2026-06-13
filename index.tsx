import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AdvancedFeatureProvider } from './contexts/AdvancedFeatureContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("루트 요소를 찾을 수 없습니다.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AdvancedFeatureProvider>
        <App />
      </AdvancedFeatureProvider>
    </ThemeProvider>
  </React.StrictMode>
);