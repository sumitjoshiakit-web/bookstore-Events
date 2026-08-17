import eslint from '@eslint/js';
import globals from 'globals';

export default [
    eslint.configs.recommended,
    {
        files: ['app.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.browser
            }
        },
        rules: {
            'no-unused-vars': 'error',
            'no-undef': 'error',
            'no-console': 'off'
        }
    }
];
