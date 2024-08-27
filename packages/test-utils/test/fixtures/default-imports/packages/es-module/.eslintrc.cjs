module.exports = {
  extends: ['../../.eslintrc.cjs'],

  overrides: [
    {
      files: ['*.js'],
      parserOptions: {
        sourceType: 'module',
      },
    },
  ],

  ignorePatterns: ['**/invalid.ts'],
};
