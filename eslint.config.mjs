import js from '@eslint/js'
import globals from 'globals'

/**
 * Configuration de ESLint pour le backend:
 * - Ignore les fichiers node_modules, dist, coverage, config.js
 * - Check s'il y a des consoles logs dans le code
 * - Check si on utilise des fonctions async sans await
 */
export default [
  {
    ignores: ['node_modules', 'dist', 'coverage', '*.config.js']
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      'require-await': 'warn',
      'no-async-promise-executor': 'error'
    }
  }
]