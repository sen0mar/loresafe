import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/core/security/**/*.ts",
        "src/modules/**/*.policy.ts",
        "src/modules/**/*repository.ts"
      ],
      exclude: ["**/*.test.ts", "**/*.integration.test.ts"],
      thresholds: {
        "src/core/security/**/*.ts": {
          branches: 45,
          functions: 45,
          lines: 70,
          statements: 70
        },
        "src/modules/**/*.policy.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        "src/modules/**/*repository.ts": {
          lines: 4,
          statements: 4
        },
        "src/modules/auth/auth-session.repository.ts": {
          branches: 60,
          functions: 60,
          lines: 70,
          statements: 70
        },
        "src/modules/notifications/notifications.repository.ts": {
          branches: 5,
          functions: 10,
          lines: 15,
          statements: 15
        },
        "src/modules/{clubs,progress,reports}/*-command.repository.ts": {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    }
  }
});
