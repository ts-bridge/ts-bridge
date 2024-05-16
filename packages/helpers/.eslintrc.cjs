module.exports = {
  extends: ['../../.eslintrc.cjs'],

  env: {
    browser: true,
    node: true,
  },

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['*.ts'],
      rules: {
        'no-restricted-globals': 'off',
      },
    },
  ],
};
