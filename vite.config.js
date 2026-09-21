import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works on Vercel, on a subpath, or opened
// straight from the filesystem. No server code, no environment variables.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
