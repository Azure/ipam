import js from "@eslint/js";
import globals from "globals";

import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import jest from "eslint-plugin-jest";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.jsx"],
    plugins: {
      react,
      "react-hooks": hooks,
      jest
    },
    settings: {
      react: {
        version: "detect",
      }
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react/no-unescaped-entities": "off",
      "no-constant-binary-expression": "off"
    },
  },
];
