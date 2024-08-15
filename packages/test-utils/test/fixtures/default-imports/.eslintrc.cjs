module.exports = {
  extends: ['../../../.eslintrc.cjs'],

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        'import-x/extensions': 'off',
        'import-x/no-duplicates': 'off',
      },
    },
  ],

  ignorePatterns: ['**/invalid.ts'],
};
