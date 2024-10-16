module.exports = {
  root: true,
  env: {
    node: true, // Enable Node.js globals
    es2020: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {},
  plugins: [],
  rules: {
    // Add or modify rules here as needed
  },
};
