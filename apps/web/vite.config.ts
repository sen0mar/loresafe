import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export const publicClientEnvKeys = [
  "VITE_SENTRY_DSN",
  "VITE_SENTRY_ENVIRONMENT",
  "VITE_SENTRY_TRACES_SAMPLE_RATE",
  "VITE_SENTRY_ENABLE_DEBUG_ROUTE",
  "VITE_PUBLIC_SITE_ORIGIN"
] as const;

export default defineConfig(({ mode }) => {
  const rootDirectory = fileURLToPath(new URL("../..", import.meta.url));
  const envValues = readRootEnvValues(rootDirectory, mode, publicClientEnvKeys);
  const defineValues = createClientEnvDefineValues(envValues);

  return {
    define: Object.keys(defineValues).length > 0 ? defineValues : undefined,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true
        },
        "/sitemap.xml": {
          target: "http://localhost:3000",
          changeOrigin: true
        }
      }
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3000",
          changeOrigin: true
        }
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json-summary", "lcov"],
        reportsDirectory: "./coverage",
        include: [
          "src/app/**/*.tsx",
          "src/features/**/api/**/*.{ts,tsx}",
          "src/features/**/components/**/*.{ts,tsx}"
        ],
        exclude: ["**/*.test.{ts,tsx}"],
        thresholds: {
          branches: 40,
          functions: 45,
          lines: 50,
          statements: 50
        }
      }
    }
  };
});

export const createClientEnvDefineValues = (
  envValues: Partial<Record<(typeof publicClientEnvKeys)[number], string>>
) =>
  Object.fromEntries(
    publicClientEnvKeys.flatMap((key) => {
      const value = envValues[key];

      return value ? [[`import.meta.env.${key}`, JSON.stringify(value)]] : [];
    })
  );

const readRootEnvValues = (
  rootDirectory: string,
  mode: string,
  keys: readonly string[]
) =>
  Object.fromEntries(
    keys.flatMap((key) => {
      const value = readRootEnvValue(rootDirectory, mode, key);

      return value ? [[key, value]] : [];
    })
  );

const readRootEnvValue = (rootDirectory: string, mode: string, key: string) => {
  const envFiles = [".env", `.env.${mode}`];

  return envFiles.reduce<string | undefined>((currentValue, fileName) => {
    const envPath = fileURLToPath(
      new URL(fileName, `file://${rootDirectory}/`)
    );

    if (!existsSync(envPath)) {
      return currentValue;
    }

    return parseEnvValue(readFileSync(envPath, "utf8"), key) ?? currentValue;
  }, process.env[key]);
};

const parseEnvValue = (content: string, key: string) => {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1 || line.slice(0, separatorIndex).trim() !== key) {
      continue;
    }

    const value = line.slice(separatorIndex + 1).trim();

    return value.replace(/^["']|["']$/g, "");
  }

  return undefined;
};
