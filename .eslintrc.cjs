module.exports = {
  root: true,

  extends: ['@metamask/eslint-config'],

  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./packages/*/tsconfig.json'],
  },

  settings: {
    'import-x/resolver': {
      node: {
        extensions: ['.js'],
      },
    },
  },

  overrides: [
    {
      files: ['*.ts', '*.cts', '*.mts'],
      extends: [
        '@metamask/eslint-config-typescript',
        '@metamask/eslint-config-nodejs',
      ],
      rules: {
        '@typescript-eslint/no-shadow': [
          'error',
          {
            allow: ['Node', 'Transformer'],
          },
        ],
        'import-x/extensions': ['error', 'ignorePackages'],
        'import-x/no-useless-path-segments': 'off',
      },
    },

    {
      files: ['*.js', '*.cjs'],
      parserOptions: {
        sourceType: 'script',
      },
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['yarn.config.cjs'],
      parserOptions: {
        sourceType: 'script',
        ecmaVersion: 2020,
      },
      settings: {
        jsdoc: {
          mode: 'typescript',
        },
      },
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['*.test.ts', '*.test.js'],
      extends: ['@metamask/eslint-config-nodejs'],
    },

    {
      files: ['./src/index.ts'],
      rules: {
        'n/shebang': 'off',
      },
    },

    {
      files: ['./test/projects/node-10/**/*.ts'],
      rules: {
        'import-x/extensions': 'off',
      },
    },
  ],

  ignorePatterns: [
    'node_modules/',
    '!.eslintrc.js',
    '!.prettierrc.js',
    'dist/',
    'docs/',
    '.yarn/',
  ],
};
