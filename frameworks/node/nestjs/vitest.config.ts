import { defineConfig } from 'vitest/config';

// As Nest's starter configures Vitest.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['UnitTests/**/*.spec.ts'],
  },
});
