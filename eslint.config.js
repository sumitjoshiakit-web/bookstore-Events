import globals from 'globals';
import eslint from '@eslint/js';

export default [
    eslint.configs.recommended,
    {
        files: ['script.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        rules: {
            'no-unused-vars': 'error',
            'no-undef': 'error',
            'no-console': 'off',
            'no-prototype-builtins': 'off'
        }
    }
];
