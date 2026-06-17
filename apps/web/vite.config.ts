import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const rootDirectory = fileURLToPath(new URL("../..", import.meta.url));
  const envValues = readRootEnvValues(rootDirectory, mode, [
    "VITE_API_BASE_URL",
    "VITE_SENTRY_DSN",
    "VITE_SENTRY_ENVIRONMENT",
    "VITE_SENTRY_TRACES_SAMPLE_RATE",
    "VITE_SENTRY_ENABLE_DEBUG_ROUTE"
  ]);
  const defineValues = Object.fromEntries(
    Object.entries(envValues).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value)
    ])
  );

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
    }
  };
});

const readRootEnvValues = (
  rootDirectory: string,
  mode: string,
  keys: string[]
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
