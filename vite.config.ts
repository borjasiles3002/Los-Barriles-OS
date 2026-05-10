import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          manifest: {
            name: 'Los Barriles OS',
            short_name: 'BarrilesOS',
            description: 'Sistema Operativo del Restaurante Los Barriles',
            theme_color: '#1f2937',
            background_color: '#111827',
            display: 'standalone',
            icons: [
              {
                src: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', // Placeholder icon
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png', 
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY || ''),
        'process.env.VITE_BUILD_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
