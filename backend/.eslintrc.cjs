/**
 * This is intended to be a basic starting point for linting in your app.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    env: {
        node: true,
        es2022: true,
    },
    ignorePatterns: ['build'],

    // Base config
    extends: ['eslint:recommended', 'prettier'],

    overrides: [
        // Typescript
        {
            files: ['**/*.{ts,tsx}'],
            plugins: ['@typescript-eslint', 'import'],
            parser: '@typescript-eslint/parser',
            settings: {
                'import/internal-regex': '^~/',
                'import/resolver': {
                    node: {
                        extensions: ['.ts', '.tsx'],
                    },
                    typescript: {
                        alwaysTryTypes: true,
                    },
                },
            },
            extends: ['plugin:@typescript-eslint/recommended', 'plugin:import/recommended', 'plugin:import/typescript'],
        },

        // Tests cast freely to reach into the socket.io client
        {
            files: ['test/**/*.ts'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
            },
        },

        // Node
        {
            files: ['.eslintrc.cjs'],
            env: {
                node: true,
            },
        },
    ],
}
