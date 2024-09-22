import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.mts',
  // 'packages/*/vitest.config.e2e.mts',
]);
