module.exports = {
  extends: ['../../../.eslintrc.cjs'],

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'import-x/no-unassigned-import': 'off',
      },
    },
  ],

  ignorePatterns: ['**/override.ts', '**/preset.ts'],
};
