import { spawn, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

const resetDatabaseUrlEnvName = "DEV_DATABASE_RESET_DATABASE_URL";

export class DevelopmentDatabaseResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevelopmentDatabaseResetError";
  }
}

export type DevelopmentResetConfig = {
  databaseUrl: string;
};

export type SeedCommand = {
  args: string[];
  command: string;
  options: SpawnOptions;
};

type QueryClient = Pick<Client, "query">;

export const loadDevelopmentResetEnv = (cwd = process.cwd()) => {
  const envPaths = [resolve(cwd, ".env"), resolve(cwd, "../../.env")];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      loadEnv({ path: envPath, override: false, quiet: true });
    }
  }
};

export const readDevelopmentResetConfig = (
  env: NodeJS.ProcessEnv
): DevelopmentResetConfig => {
  if (env.NODE_ENV !== "development") {
    throw new DevelopmentDatabaseResetError(
      "Refusing to reset the database unless NODE_ENV is exactly development."
    );
  }

  const databaseUrl = env[resetDatabaseUrlEnvName]?.trim();

  if (!databaseUrl) {
    throw new DevelopmentDatabaseResetError(
      `Refusing to reset the database without ${resetDatabaseUrlEnvName}.`
    );
  }

  if (!isPostgresUrl(databaseUrl)) {
    throw new DevelopmentDatabaseResetError(
      `${resetDatabaseUrlEnvName} must be a valid postgres:// or postgresql:// URL.`
    );
  }

  return {
    databaseUrl
  };
};

export const createTruncatePublicTablesSql = (tableNames: string[]) => {
  const dataTables = tableNames.filter(
    (tableName) => tableName !== "_prisma_migrations"
  );

  if (dataTables.length === 0) {
    return null;
  }

  const tableList = dataTables
    .map(
      (tableName) =>
        `${quoteSqlIdentifier("public")}.${quoteSqlIdentifier(tableName)}`
    )
    .join(", ");

  return `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`;
};

export const listPublicDataTables = async (client: QueryClient) => {
  const result = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name;
  `);

  return result.rows.map((row) => row.table_name);
};

export const truncateDevelopmentData = async (client: QueryClient) => {
  const tableNames = await listPublicDataTables(client);
  const truncateSql = createTruncatePublicTablesSql(tableNames);

  if (!truncateSql) {
    console.log("No public application tables found to truncate.");
    return tableNames;
  }

  console.log(
    `Truncating ${tableNames.length} public application tables in the development database.`
  );
  await client.query(truncateSql);

  return tableNames;
};

export const buildSeedCommand = (
  databaseUrl: string,
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
): SeedCommand => ({
  command: "pnpm",
  args: ["prisma:seed"],
  options: {
    cwd,
    env: {
      ...env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: "development"
    },
    stdio: "inherit"
  }
});

export const runExistingSeed = (
  databaseUrl: string,
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const seedCommand = buildSeedCommand(databaseUrl, cwd, env);
    const child = spawn(
      seedCommand.command,
      seedCommand.args,
      seedCommand.options
    );

    child.on("error", rejectPromise);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new DevelopmentDatabaseResetError(
          `Seed command failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`
        )
      );
    });
  });

export const resetDevelopmentDatabase = async () => {
  loadDevelopmentResetEnv();
  const { databaseUrl } = readDevelopmentResetConfig(process.env);
  const client = new Client({
    application_name: "loresafe-development-database-reset",
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    await truncateDevelopmentData(client);
  } finally {
    await client.end();
  }

  console.log(
    "Running existing Prisma seed against the development database."
  );
  await runExistingSeed(databaseUrl);
  console.log("Development database reset completed.");
};

const isPostgresUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "postgres:" || url.protocol === "postgresql:";
  } catch {
    return false;
  }
};

const quoteSqlIdentifier = (identifier: string) =>
  `"${identifier.replace(/"/g, '""')}"`;

const isDirectRun = () =>
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun()) {
  resetDevelopmentDatabase().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Development database reset failed: ${message}`);
    process.exit(1);
  });
}
