import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/pwa_Metronome/',
  plugins: [
    VitePWA({
      // SW is registered manually via workbox-window in main.ts
      injectRegister: false,
      // 'autoUpdate' makes the new SW automatically skip waiting and take over.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Metronome Pro',
        short_name: 'Metronome',
        description: 'Professional Grade Metronome for Musicians',
        theme_color: '#161e2e',
        background_color: '#0a0f1d',
        display: 'standalone',
        icons: [
          {
            src: 'assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {},
      devOptions: {
        // Keep SW disabled in dev to avoid conflicts with Vite HMR
        enabled: false,
        type: 'module'
      }
    })
  ],
  server: {
    host: true
  }
});
