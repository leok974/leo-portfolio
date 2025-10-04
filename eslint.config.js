// eslint.config.js (refined baseline)
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import markdown from '@eslint/markdown';
import yml from 'eslint-plugin-yml';
import yamlParser from 'yaml-eslint-parser';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  { plugins: { markdown } },

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.husky/**',
      '.venv/**',
      'assistant_api/**'
    ],
  },

  // Browser app code
  {
    files: [
      'js/**/*.js',
      'main.js',
      'assistant-*.js',
      'agent-status.js',
    ],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        // Core browser
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        console: 'readonly',
        // Fetch + streams
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        ReadableStream: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
  FormData: 'readonly',
        // Timers / RAF / microtasks
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        queueMicrotask: 'readonly',
  getComputedStyle: 'readonly',
        // Storage / caches
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        // DOM types commonly referenced
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLImageElement: 'readonly',
  HTMLVideoElement: 'readonly',
  HTMLDialogElement: 'readonly',
  HTMLInputElement: 'readonly',
        Image: 'readonly',
        Node: 'readonly',
        Document: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        // Custom globals used in your bundle
        indexHTML: 'readonly',
        dirname: 'readonly',
      },
    },
    rules: {
      'no-implicit-globals': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Allow pragmatic ts-comments and any in JS JSDoc contexts
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    },
  },

  // Service worker
  {
    files: ['sw.js', 'js/**/sw-*.js'],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        self: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    },
  },

  // Node / build / runtime scripts
  {
    files: [
      'scripts/**',
      '**/*.config.{js,cjs,mjs}',
      '**/*.mjs',
      'optimize-media.js',
      'generate-projects.js',
      'validate-schema.js',
      'edge/**/*.js',
      'deploy/**/*.js',
      'cloudflared/**/*.js',
    ],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        fetch: 'readonly' // Node 18+
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-unused-vars': 'off'
    },
  },

  // TS sources — relax a couple of rules for now
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'prefer-const': 'off'  // calm noisy style churn; re-enable later if desired
    },
  },

  // Frontend source inline style guard
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.type='MemberExpression'][left.property.name='style']",
          message: 'Avoid inline style mutations; use CSS classes or data-attributes.'
        },
        {
          selector: "CallExpression[callee.object.property.name='style'][callee.property.name='setProperty']",
          message: 'Avoid inline style mutations (setProperty); prefer CSS classes.'
        },
        {
          selector: "Literal[value=/on[a-z]+\\s*=\\s*(\"|')/i]",
          message: 'Inline event handlers are disallowed. Use addEventListener instead.'
        },
        {
          selector: "TemplateElement[value.raw=/on[a-z]+\\s*=\\s*(\"|')/i]",
          message: 'Inline event handlers are disallowed in template literals.'
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML'][right.regex.pattern=/on[a-z]+\\s*=\\s*(\"|')/i]",
          message: 'Avoid innerHTML with inline handlers; sanitize and use DOM APIs instead.'
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Avoid dangerouslySetInnerHTML; prefer structured rendering.'
        }
      ]
      // Optionally add a no-restricted-properties rule if reads should also be disallowed.
    }
  },

  // Tests (Vitest / Playwright)
  {
    files: ['tests/**/*.{js,ts,tsx}'],
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-function': ['warn', { allow: ['methods','arrowFunctions'] }],
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'prefer-const': 'off'
    },
  },

  // Ambient declarations
  {
    files: ['types/**/*.d.ts', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    },
  },

  // ESM guard: disallow CommonJS require/module/exports usage in .js (use .cjs or convert to ESM)
  {
    files: ['**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='require']",
          message: 'CommonJS require() is not allowed in .js files (ESM-first project). Use import syntax, .mjs, or rename to .cjs if truly needed.'
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'module', message: 'Use ESM exports in .js files (rename to .cjs if CommonJS needed).' },
        { name: 'exports', message: 'Use ESM exports in .js files (rename to .cjs if CommonJS needed).' }
      ]
    }
  },

  // Markdown processor (lint fenced code blocks only)
  {
    files: ['**/*.md'],
    processor: 'markdown/markdown'
  },
  // Optional: code block overrides (JS/TS) inside Markdown
  {
    files: ['**/*.md/*.js', '**/*.md/*.ts', '**/*.md/*.tsx'],
    // Keep minimal; could extend base JS/TS rules
    rules: {}
  },
  // YAML linting
  {
    plugins: { yml },
    files: ['**/*.{yml,yaml}'],
    languageOptions: { parser: yamlParser },
    rules: {
      'yml/indent': ['error', 2],
      'yml/no-empty-document': 'error'
    }
  }
];
