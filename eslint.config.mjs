import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "apps/api/src/generated/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "apps/api/**/*.{ts,mjs}",
      "e2e/**/*.ts",
      "scripts/**/*.mjs",
      "*.{js,mjs,ts}"
    ],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: [
      "apps/api/src/modules/clubs/{clubs.service,clubs.dto}.ts",
      "apps/api/src/modules/reports/{reports.service,reports.dto,reports.policy}.ts",
      "apps/api/src/modules/progress/{progress.service,progress.dto}.ts"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "./clubs.repository.js",
                "./reports.repository.js",
                "./progress.repository.js"
              ],
              message:
                "Use repository contracts and the narrow command/query repository boundary."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error"
    }
  },
  {
    files: [
      "apps/web/src/shared/api/**/*.{ts,tsx}",
      "apps/web/src/shared/lib/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/features/**"],
              message:
                "Low-level shared API and library modules must not depend on feature modules."
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      "apps/api/src/core/http/**/*.ts",
      "apps/api/src/core/logging/**/*.ts",
      "apps/api/src/core/security/**/*.ts"
    ],
    ignores: ["**/*.test.ts", "**/*.integration.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../modules/*", "../../modules/**"],
              message:
                "Core HTTP, logging, and security code must not depend on feature modules."
            }
          ]
        }
      ]
    }
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": "off"
    }
  }
);
