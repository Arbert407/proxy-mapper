import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import { join } from 'node:path';

const rendererRoot = join(__dirname, 'src', 'renderer');
const sharedRoot = join(__dirname, 'src', 'shared');
const rendererOutDir = join(__dirname, 'dist', 'renderer');
const mainOutDir = join(__dirname, 'dist', 'main');
const preloadOutDir = join(__dirname, 'dist', 'preload');
const mainEntry = join(__dirname, 'src', 'main', 'index.ts');
const preloadEntry = join(__dirname, 'src', 'preload', 'index.ts');

export default defineConfig({
  root: rendererRoot,
  publicDir: false,
  plugins: [
    react(),
    electron({
      main: {
        entry: mainEntry,
        vite: {
          build: {
            outDir: mainOutDir,
            emptyOutDir: true,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      preload: {
        input: preloadEntry,
        vite: {
          build: {
            outDir: preloadOutDir,
            emptyOutDir: true,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': rendererRoot,
      '@shared': sharedRoot,
    },
  },
  build: {
    outDir: rendererOutDir,
    emptyOutDir: true,
  },
});

