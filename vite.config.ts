/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Add Vitest configuration
    globals: true, // Enable global API (vi, describe, it, etc.)
    environment: 'node', // Specify the test environment
    pool: 'forks', // Run tests in separate processes for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid mock conflicts
      },
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'index-multi': resolve(__dirname, 'src/index-multi.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        '@modelcontextprotocol/sdk',
        'bun',
        'process',
        'express',
        'crypto',
        'node:crypto',
        'node:process',
        'url',
        'async_hooks',
        'buffer',
        'string_decoder',
        'raw-body',
        'dotenv',
        'dotenv/config',
        'path',
        'os',
        'fs',
      ],
    },
    outDir: 'dist',
    sourcemap: true,
  },
  plugins: [dts()],
});
