const eslint = require('@eslint/js');
const prettier = require('eslint-config-prettier');

module.exports = [
    eslint.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'commonjs',
            globals: {
                // Node.js globals
                'process': 'readonly',
                'console': 'readonly',
                '__dirname': 'readonly',
                'module': 'readonly',
                'require': 'readonly',
                // Jest globals
                'describe': 'readonly',
                'test': 'readonly',
                'expect': 'readonly',
                'beforeAll': 'readonly',
                'afterAll': 'readonly',
                'beforeEach': 'readonly',
                'afterEach': 'readonly',
                'fail': 'readonly'
            }
        },
        rules: {
            // Variables
            'no-unused-vars': ['error', { 
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_'
            }],

            // Best practices
            'no-console': 'off', // 允许使用 console，因为这是 Node.js 项目
            'eqeqeq': ['error', 'always'],
            'prefer-const': 'error',
            'no-var': 'error',
            'curly': ['error', 'all'],
            'no-throw-literal': 'error',
            'prefer-promise-reject-errors': 'error',

            // Style
            'spaced-comment': ['error', 'always'],
            'capitalized-comments': ['warn', 'always'],
            'multiline-comment-style': ['error', 'starred-block'],
            'quotes': ['error', 'single', { 'avoidEscape': true }],
            'semi': ['error', 'always']
        }
    },
    prettier
];
