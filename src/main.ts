import './styles/main.css';
import { Workbox } from 'workbox-window';
import { Metronome } from './core/Metronome';
import { Tuner } from './core/Tuner';
import { UIController } from './components/UIController';

// Hoisted so the SW waiting handler can check playback state
let metronome: Metronome;

/**
 * App Bootstrapper
 */
const bootstrap = () => {
  metronome = new Metronome();
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

  // A new SW has installed and is waiting to activate
  wb.addEventListener('waiting', () => {
    const promptUpdate = () => {
      if (confirm('New version available. Reload to update?')) {
        // Reload once the new SW takes control
        const onControlling = () => window.location.reload();
        wb.addEventListener('controlling', onControlling);
        wb.messageSkipWaiting();
      }
    };

    if (metronome?.isPlaying) {
      // Poll every second until playback stops, then prompt.
      // Cap at 5 minutes to ensure the user is never silently stuck on an old version.
      const MAX_WAIT_MS = 5 * 60 * 1000;
      const startedAt = Date.now();
      const pollId = setInterval(() => {
        if (!metronome.isPlaying || Date.now() - startedAt >= MAX_WAIT_MS) {
          clearInterval(pollId);
          promptUpdate();
        }
      }, 1000);
    } else {
      promptUpdate();
    }
  });

  wb.register();
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
