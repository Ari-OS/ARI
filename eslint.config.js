import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': 'warn',
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    files: ['src/cli/**/*.ts', 'src/governance/**/*.ts', 'src/ops/**/*.ts', 'src/api/**/*.ts', 'src/system/**/*.ts', 'src/kernel/event-bus.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.test.ts', 'vitest.config.ts', 'eslint.config.js', 'src/e2e/**', 'coverage/**', 'dashboard/dist/**', 'dashboard/postcss.config.js', 'scripts/**', 'playwright.config.ts', 'commitlint.config.js', '**/*.js'],
  }
);
