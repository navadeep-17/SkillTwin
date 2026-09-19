import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "react/no-unescaped-entities": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts"
  ])
]);
