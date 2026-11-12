import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import chaiFriendly from 'eslint-plugin-chai-friendly'
import mochaPlugin from 'eslint-plugin-mocha'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

export default [
  // Ignores (remplace --ignore-path .gitignore + ignorePatterns)
  // Seuls les .ts sont lintés (comportement identique à l'ancienne config --ext ".ts")
  {
    ignores: [
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      'dist/**',
      'node_modules/**',
      'scripts/node_modules/**',
      'coverage/**',
      '.nyc_output/**'
    ]
  },
  // typescript-eslint recommended en flat config (parser + plugin inclus)
  ...tseslint.configs['flat/recommended'],
  // Config principale
  {
    files: ['**/*.ts'],
    plugins: {
      'chai-friendly': chaiFriendly,
      mocha: mochaPlugin
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.mocha
      }
    },
    rules: {
      ...chaiFriendly.configs.recommendedFlat.rules,

      // Règles mocha désactivées : le codebase utilise des patterns incompatibles
      // (setup dans describe, exports de helpers de test, hooks globaux, etc.)
      'mocha/no-setup-in-suite': 'off',
      'mocha/no-root-hooks': 'off',
      'mocha/no-exports': 'off',
      'mocha/no-identical-title': 'off',
      'mocha/no-nested-tests': 'off',
      'mocha/no-pending-tests': 'off',
      'mocha/consistent-spacing-between-blocks': 'off',

      // empty interfaces intentionnelles (Command, Query base types)
      '@typescript-eslint/no-empty-object-type': 'off',

      'no-console': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'error',
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },
  // Prettier en dernier (désactive les règles de formatage conflictuelles)
  prettierRecommended
]
