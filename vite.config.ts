import { defineConfig } from 'vitest/config';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [webExtension()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
