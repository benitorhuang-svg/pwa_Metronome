import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { Metronome } from './core/Metronome';
import { Tuner } from './core/Tuner';
import { UIController } from './components/UIController';

/**
 * App Bootstrapper
 */
const bootstrap = () => {
  const metronome = new Metronome();
  const tuner = new Tuner();
  
  // Initialize the UI Controller with both engines
  new UIController(metronome, tuner);
  
  console.info('Metronome Pro: Industrial Atomic Edition (Node 25)');
};

// Register Service Worker
registerSW({ immediate: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

/**
 * HMR Support (Vite)
 * Ensures changes reflect instantly without full page refresh during dev.
 */
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.info('HMR: Hot Update Accepted');
    // For vanilla JS, often a simple reload is cleanest, but accept() enables HMR
    // location.reload(); 
  });
}
