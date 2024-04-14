import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    watch: false,

    coverage: {
      enabled: true,

      // Configure the coverage provider. We use `istanbul` here, because it
      // is more stable than `v8`.
      provider: 'istanbul',

      // Only include source files in the `packages` directory.
      include: ['packages/*/src/**'],

      // Exclude certain files from the coverage.
      exclude: ['packages/test-utils/**'],

      // Hide files with 100% coverage.
      skipFull: true,

      // Coverage tresholds. If the coverage is below these thresholds, the test
      // will fail.
      thresholds: {
        // Auto-update the coverage thresholds.
        autoUpdate: true,

        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
