import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

// NGROK-SKIP-WARNING-INTERCEPTOR
// Adiciona header ngrok-skip-browser-warning em TODAS as chamadas fetch
// Necessário porque o Ngrok gratuito bloqueia requisições sem esse header
const _originalFetch = window.fetch;
window.fetch = function(url, options) {
  options = options || {};
  options.headers = options.headers || {};

  // Se headers for um objeto normal, adiciona o header
  if (typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
    if (!options.headers['ngrok-skip-browser-warning']) {
      options.headers['ngrok-skip-browser-warning'] = 'true';
    }
  }

  return _originalFetch.call(this, url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
