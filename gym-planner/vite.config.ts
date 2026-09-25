/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';


/**
 * GP_SINGLE=1 erzeugt einen Ein-Datei-Build (keine Code-Aufteilung, dynamische Importe eingebettet)
 * für Umgebungen, die nur eingebettete Skripte erlauben (z. B. Veröffentlichung als einzelne HTML-Seite).
 */
const single = process.env.GP_SINGLE === '1';

export default defineConfig({
  // Relative Pfade: läuft unter jeder Basis-URL (GitHub Pages, Unterordner, file://-Vorschau).
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    outDir: single ? 'dist-single' : 'dist',
    modulePreload: !single,
    rolldownOptions: {
      output: single ? { inlineDynamicImports: true } : {
        // Explizite Chunk-Gruppen (Rolldown): ohne sie zieht die konva-/three-Gruppe ihre Abhängigkeiten (React, Zustand,
        // use-sync-external-store, jsx-runtime …) mit hinein, der Einstiegs-Chunk importiert sie dann aus dem three-Chunk
        // und three.js (≈ 930 kB) wird beim Start per modulepreload geladen. Höhere Priorität = zuerst zugeordnet.
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /node_modules[\\/](react|react-dom|scheduler|react-reconciler|its-fine|zustand|zundo|immer|use-sync-external-store)[\\/]/, priority: 40, includeDependenciesRecursively: false },
            { name: 'three', test: /node_modules[\\/](three|three-stdlib|@react-three|suspend-react|react-use-measure)[\\/]/, priority: 30, includeDependenciesRecursively: false },
            { name: 'konva', test: /node_modules[\\/](konva|react-konva)[\\/]/, priority: 20, includeDependenciesRecursively: false },
            { name: 'pdf', test: /node_modules[\\/]jspdf[\\/]/, priority: 10, includeDependenciesRecursively: false },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
