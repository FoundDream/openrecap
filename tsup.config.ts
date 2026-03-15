import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  async onSuccess() {
    const { cpSync } = await import('node:fs');
    cpSync('src/render/template', 'dist/template', { recursive: true });
  },
});
