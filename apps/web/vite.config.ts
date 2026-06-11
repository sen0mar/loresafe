import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const rootDirectory = fileURLToPath(new URL("../..", import.meta.url));
  const apiBaseUrl = readRootEnvValue(rootDirectory, mode, "VITE_API_BASE_URL");

  return {
    define: apiBaseUrl
      ? {
          "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBaseUrl)
        }
      : undefined,
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
