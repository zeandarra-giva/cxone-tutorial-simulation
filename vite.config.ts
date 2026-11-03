import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // one JS + one CSS file, nothing split out, so it can be inlined into a single HTML file
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
