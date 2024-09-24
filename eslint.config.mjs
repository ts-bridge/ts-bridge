import base from '@metamask/eslint-config';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';
import tseslint from 'typescript-eslint';

const config = tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/docs/',
      '.yarn/',
      '**/invalid.ts',
    ],
  },

  {
    extends: base,

    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./packages/*/tsconfig.json'],
      },
    },

    rules: {
      // TODO: Upstream to shared config(?)
      'import-x/no-unresolved': 'off',
      'no-implicit-globals': 'off',
    },

    settings: {
      'import-x/extensions': ['.js', '.mjs'],
    },
  },

  {
    files: ['**/*.ts', '**/*.cts', '**/*.mts'],
    extends: [...typescript, ...nodejs],
    rules: {
      // TODO: Upstream to shared config(?)
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-duplicate-type-constituents': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',

      '@typescript-eslint/no-shadow': [
        'error',
        {
          allow: ['Node', 'Transformer'],
        },
      ],

      // TODO: There rules are actually good, but causes problems with
      //  TypeScript, since TypeScript only supports named imports from version
      //  5.5, while we want to support >= 4.8. We should re-enable this rule
      //  when we drop support for TypeScript < 5.5.
      'import-x/default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-useless-path-segments': 'off',

      // TypeScript's API is synchronous, so we need to use sync methods in some
      // cases.
      'n/no-sync': 'off',
    },
  },

  {
    files: ['packages/cli/src/index.ts'],
    rules: {
      'n/hashbang': 'off',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.js'],
    extends: nodejs,
    rules: {
      'n/no-sync': 'off',
    },
  },

  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
    extends: nodejs,
  },

  {
    files: [
      'packages/test-utils/test/**/*.ts',
      'packages/test-utils/test/**/*.js',
    ],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'import-x/no-duplicates': 'off',
      'import-x/no-dynamic-require': 'off',
      'import-x/no-unassigned-import': 'off',
      'import-x/order': 'off',
      'import-x/unambiguous': 'off',
      'no-restricted-globals': 'off',
      'no-undef': 'off',
    },
  },
);

export default config;
