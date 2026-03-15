import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/frontend/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // --- IGNORE (using any for yaml parsing, will look into alternative solution) ---
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // vars starting w/ underscores are allowed to be unused - for now.
    },
  },
);
