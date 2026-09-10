/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site under /<repo>/ unless a custom domain is set.
// The deploy workflow passes VITE_BASE=/seoul-in-time/; local dev stays at /.
const base = process.env.VITE_BASE ?? '/'

// getUserMedia and DeviceOrientation need a secure context. On a phone that
// means https, so `npm run dev:https` enables a self-signed cert. Desktop dev
// stays on plain http (localhost counts as secure) and avoids cert prompts.
const https = process.env.DEV_HTTPS === '1'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    ...(https ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '서울 인 타임',
        short_name: '서울인타임',
        description: '지금 서 있는 그 자리에서, 그때를 본다.',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Historical images are large; do not precache them. Only the shell.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  server: { host: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
