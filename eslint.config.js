const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...tsPlugin.configs['flat/recommended'],
  prettierConfig,
  {
    files: ['bin/**/*.ts', 'lib/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    ignores: ['cdk.out/', '**/*.js', '**/*.d.ts', 'node_modules/'],
  },
];
