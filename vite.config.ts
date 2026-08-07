import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    host: '0.0.0.0',
  },
  build: {
    sourcemap: 'hidden',
    outDir: 'dist',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths(),
    // PWA 配置 - 禁用自动更新，使用 prompt 模式
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        // 不要自动清理旧缓存，避免循环刷新
        cleanupOutdatedCaches: false,
      },
      manifest: false,
      // 不自动注入 SW，使用自定义的 registerSW.js
      injectRegister: false,
    }),
  ],
})
