module.exports = {
  extends: ['../../../.eslintrc.cjs'],

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off',
        'import-x/extensions': 'off',
        'import-x/no-unassigned-import': 'off',
      },
    },
  ],

  ignorePatterns: ['**/invalid.ts'],
};
