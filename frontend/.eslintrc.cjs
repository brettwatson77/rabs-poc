module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'react/prop-types': 'off',
    'max-lines': ['error', {
      max: 1200,
      skipBlankLines: true,
      skipComments: true
    }],
    'complexity': 'off'
  },
  overrides: [
    {
      files: ['src/pages/**/*.jsx'],
      rules: {
        'max-lines': ['error', {
          max: 1400,
          skipBlankLines: true,
          skipComments: true
        }]
      }
    },
    {
      files: ['src/pages/Vehicles.jsx'],
      rules: {
        'max-lines': ['error', {
          max: 2000,
          skipBlankLines: true,
          skipComments: true
        }]
      }
    }
  ],
  ignorePatterns: ['dist', 'node_modules']
};

