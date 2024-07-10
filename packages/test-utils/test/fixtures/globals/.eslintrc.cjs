module.exports = {
  extends: ['../../../.eslintrc.cjs'],

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'import-x/no-unassigned-import': 'off',
        'n/no-unsupported-features/node-builtins': 'off',
      },
    },
  ],

  ignorePatterns: ['**/invalid.ts'],
};
