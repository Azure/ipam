import js from "@eslint/js";
import globals from "globals";

import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jest from "eslint-plugin-jest";

export default [
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
    plugins: {
      jest,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
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
    ...react.configs.flat.recommended,
    files: ["src/**/*.jsx"],
  },

  // JSX runtime rules — disables rules not needed with React 17+ automatic JSX transform
  {
    ...react.configs.flat["jsx-runtime"],
    files: ["src/**/*.jsx"],
  },

  // Configuration for React JSX files
  {
    files: ["src/**/*.jsx"],
    plugins: {
      "react-hooks": reactHooks,
      jest,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
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
        ...globals.jest,
      },
    },
    rules: {
      // ESLint core rules
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-constant-binary-expression": "off",

      // React rules — relax some recommended rules for this codebase
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/no-unescaped-entities": "error",

      // React Hooks rules - CRITICAL for catching hooks-related bugs
      "react-hooks/rules-of-hooks": "error", // Enforces Rules of Hooks
      "react-hooks/exhaustive-deps": "warn",  // Checks effect dependencies
    },
  },
];
