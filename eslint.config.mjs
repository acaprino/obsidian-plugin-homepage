import globals from "globals";
import tsparser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  comments.recommended,
  {
    // Typed rules cannot run on JSON files (no parserOptions.project)
    files: ["**/*.json"],
    rules: {
      "obsidianmd/no-plugin-as-component": "off",
    },
  },
  {
    rules: {
      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        "obsidianmd/no-static-styles-assignment",
        "obsidianmd/ui/sentence-case",
      ],
    },
  },
  {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        ...globals.browser,
        ...globals.node,
        structuredClone: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
]);
