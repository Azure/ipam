import js from "@eslint/js";
import globals from "globals";

import eslintReact from "@eslint-react/eslint-plugin";
import reactCompiler from "eslint-plugin-react-compiler";

export default [
  // Ignore build output
  { ignores: ["dist/"] },

  // Base ESLint recommended rules
  js.configs.recommended,

  // Configuration for root-level JS files (config files, etc.)
  {
    files: ["*.js", "*.mjs", "*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-constant-binary-expression": "off",
    },
  },

  // Configuration for source JS files (non-JSX)
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-constant-binary-expression": "off",
    },
  },

  // React recommended rules (scoped to JSX files)
  {
    ...eslintReact.configs.recommended,
    files: ["src/**/*.jsx"],
  },

  // Disable RSC rules (Vite SPA, not using React Server Components)
  // Disable rules-of-hooks and exhaustive-deps (covered by react-compiler)
  // Downgrade component-hook-factories (duplicates no-nested-component-definitions)
  // Disable set-state-in-effect (widespread pattern, to be addressed incrementally)
  {
    files: ["src/**/*.jsx"],
    rules: {
      "@eslint-react/rsc-function-definition": "off",
      "@eslint-react/no-nested-component-definitions": "warn",
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/component-hook-factories": "warn",
      "@eslint-react/set-state-in-effect": "off",
    },
  },

  // React Compiler rules (replaces eslint-plugin-react-hooks)
  {
    ...reactCompiler.configs.recommended,
    files: ["src/**/*.jsx"],
    rules: {
      "react-compiler/react-compiler": "warn",
    },
  },

  // Configuration for React JSX files
  {
    files: ["src/**/*.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-constant-binary-expression": "off",
    },
  },
];
