import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Use base path for GitHub Pages or Wix embedding
    // Set VITE_GITHUB_PAGES=true when building for GitHub Pages
    const isGitHubPages = env.VITE_GITHUB_PAGES === 'true';
    const base = isGitHubPages ? '/PipeVault/' : '/';

    return {
      base,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Generate relative paths for better portability
        assetsDir: 'assets',
        // Optimize for embedding
        minify: 'terser',
        sourcemap: false,
      }
    };
});
