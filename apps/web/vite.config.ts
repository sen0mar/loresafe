import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export const publicClientEnvKeys = [
  "VITE_API_BASE_URL",
  "VITE_SENTRY_DSN",
  "VITE_SENTRY_ENVIRONMENT",
  "VITE_SENTRY_TRACES_SAMPLE_RATE",
  "VITE_SENTRY_ENABLE_DEBUG_ROUTE"
] as const;

export default defineConfig(({ mode }) => {
  const rootDirectory = fileURLToPath(new URL("../..", import.meta.url));
  const envValues = readRootEnvValues(rootDirectory, mode, publicClientEnvKeys);
  validateClientEnvValues(mode, envValues);
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
      host: "localhost",
      port: 5173
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true
    }
  };
});

export const validateClientEnvValues = (
  mode: string,
  envValues: Partial<Record<(typeof publicClientEnvKeys)[number], string>>
) => {
  if (mode === "production" && !envValues.VITE_API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is required for production builds.");
  }
};

export const createClientEnvDefineValues = (
  envValues: Partial<Record<(typeof publicClientEnvKeys)[number], string>>
) =>
  Object.fromEntries(
    publicClientEnvKeys.flatMap((key) => {
      const value = envValues[key];

      return value
        ? [[`import.meta.env.${key}`, JSON.stringify(value)]]
        : [];
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

const readRootEnvValue = (
  rootDirectory: string,
  mode: string,
  key: string
) => {
  const envFiles = [".env", `.env.${mode}`];

  return envFiles.reduce<string | undefined>((currentValue, fileName) => {
    const envPath = fileURLToPath(new URL(fileName, `file://${rootDirectory}/`));

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
