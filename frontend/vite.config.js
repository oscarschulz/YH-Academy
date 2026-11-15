import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = 'http://localhost:3000'


const LEGACY_REFERENCE_ARTIFACTS = [
  'internal/ai-nurture.html',
  'internal/ai-nurture.css',
  'internal/ai-nurture.js',
  'apply.html',
  'dashboard.html',
  'academy.html',
  'plaza.html',
  'federation.html',
  'business-chats.html',

  'js/apply.js',
  'js/dashboard.js',
  'js/academy.js',
  'js/plaza.js',
  'js/federation.js',
  'js/business-chats.js',
  'js/yh-division-tutorials.js',

  'css/plaza.css',
  'css/federation.css',
  'css/business-chats.css',
  'css/style.css',
  'css/yh-tailwind.css',
  'css/yhu-game-system.css',
  'css/dashboard-mobile.css',
  'css/yh-division-tutorials.css',
]

function stripLegacyReferenceArtifacts() {
  return {
    name:
      'yhu-strip-legacy-reference-artifacts',

    apply:
      'build',

    async closeBundle() {
      const {
        rm,
      } =
        await import(
          'node:fs/promises'
        )

      const {
        resolve,
      } =
        await import(
          'node:path'
        )

      const distDir =
        resolve(
          process.cwd(),
          'dist',
        )

      for (
        const relativePath
        of LEGACY_REFERENCE_ARTIFACTS
      ) {
        await rm(
          resolve(
            distDir,
            relativePath,
          ),
          {
            force: true,
          },
        )
      }

      console.log(
        '[YHU Vite] Legacy reference artifacts excluded from production bundle.',
      )
    },
  }
}

/* YHU_STRIP_LEGACY_REFERENCE_ARTIFACTS */

export default defineConfig({
  plugins: [
    react(),
    stripLegacyReferenceArtifacts(),
  ],

  // Temporary migration bridge:
  // reuse the existing YHU public assets directly.
  publicDir: './web-public',

  server: {
    port: 5173,

    proxy: {
      '/uploads': { target: "http://localhost:3000", changeOrigin: true },
      '^/admin(?:/|$)': { target: backendTarget, changeOrigin: true },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },

      '/socket.io': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
