/* Interaktívne modely konvenčných obrábacích strojov (React 19 + three.js r186).
   Mierka: 1 jednotka scény = 100 mm, obsluha stojí na strane +Z. */
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/share-tech-mono/400.css';
import './tailwind.css';
import './app.css';
import App from './App';

createRoot(document.getElementById('root')).render(<App />);

// offline režim: service worker si pri prvej návšteve uloží celú aplikáciu
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* bez offline režimu */ }); });
}
