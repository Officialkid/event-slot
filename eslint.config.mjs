import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "**/.next/**",
    ".tmp-gcloud/**",
    "**/.tmp-gcloud/**",
    "mobile/**",
    "**/mobile/**",
    "docs-site/.next/**",
    "**/docs-site/.next/**",
    "docs-site/out/**",
    "**/docs-site/out/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "public/sw.js",
    "public/workbox-*.js",
    "public/fallback-*.js",
    "twa/app/build/**",
    "scripts/**",
    "Docx/**",
    "investor-package/**",
    "maintenance/**",
  ]),
]);
