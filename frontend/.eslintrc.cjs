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
    'complexity': ['warn', 20]
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
    }
  ],
  ignorePatterns: ['dist', 'node_modules']
};
