import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['public/**', 'node_modules/**', '.wrangler/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    settings: { react: { version: '19.3' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    files: ['static/**/*.js'],
    languageOptions: { ecmaVersion: 5, sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['sw-template.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker, __PRECACHE__: 'readonly', __ALL__: 'readonly' } },
  },
  {
    files: ['tests-e2e/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['*.config.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
];
