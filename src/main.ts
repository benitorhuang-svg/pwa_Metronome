import './styles/main.css';
import '@fontsource-variable/outfit';
import { Workbox } from 'workbox-window';
import { Metronome } from './core/Metronome';
import { Tuner } from './core/Tuner';
import { UIController } from './components/UIController';

/**
 * App Bootstrapper
 */
const bootstrap = () => {
  const metronome = new Metronome();
  const tuner = new Tuner();
  
  new UIController(metronome, tuner);

  if (import.meta.env.DEV) {
    console.info('Metronome Pro: Industrial Atomic Edition');
  }
};

// Register Service Worker with full lifecycle via workbox-window (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`);

  // First install: app is now ready for offline use
  wb.addEventListener('installed', (event) => {
    if (!event.isUpdate) {
      console.info('[SW] App is ready for offline use.');
    }
  });

  // New SW activated and in control: reload to use the latest cached assets
  wb.addEventListener('controlling', () => {
    window.location.reload();
  });

  wb.register();

  // Expose update trigger for in-app long-press gesture (mobile-friendly)
  (window as unknown as Record<string, unknown>)['__wb_update'] = () => wb.update();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// HMR Support (Vite dev only)
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    if (import.meta.env.DEV) console.info('HMR: Hot Update Accepted');
  });
}
