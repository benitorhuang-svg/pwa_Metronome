import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Metronome Pro',
        short_name: 'Metronome',
        description: 'Professional Grade Metronome for Musicians',
        theme_color: '#161e2e',
        background_color: '#0a0f1d',
        display: 'standalone',
        icons: [
          {
            src: 'assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    hot: true
  }
});
