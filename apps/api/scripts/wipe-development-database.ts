import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  loadDevelopmentResetEnv,
  truncateDevelopmentData
} from "./reset-development-database.js";
import { readMatchingNeonDatabaseTarget } from "./neon-database-target.js";

const wipeConfirmation =
  "I_UNDERSTAND_THIS_PERMANENTLY_DELETES_DEVELOPMENT_DATA";

export class DevelopmentDatabaseWipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevelopmentDatabaseWipeError";
  }
}

export type DevelopmentWipeConfig = {
  databaseUrl: string;
  endpointId: string;
};

export const readDevelopmentWipeConfig = (
  env: NodeJS.ProcessEnv
): DevelopmentWipeConfig => {
  if (env.NODE_ENV !== "development") {
    throw new DevelopmentDatabaseWipeError(
      "Refusing to wipe the database unless NODE_ENV is exactly development."
    );
  }

  if (env.DEV_DATABASE_WIPE_CONFIRM !== wipeConfirmation) {
    throw new DevelopmentDatabaseWipeError(
      "Refusing to wipe the development database without the exact destructive confirmation."
    );
  }

  const expectedEndpointId = env.DEV_DATABASE_WIPE_NEON_ENDPOINT_ID?.trim();

  if (!expectedEndpointId) {
    throw new DevelopmentDatabaseWipeError(
      "Refusing to wipe the development database without DEV_DATABASE_WIPE_NEON_ENDPOINT_ID."
    );
  }

  const runtimeUrl = requireDatabaseUrl(env.DATABASE_URL, "DATABASE_URL");
  const directUrl = requireDatabaseUrl(env.DIRECT_URL, "DIRECT_URL");
  const target = readMatchingNeonDatabaseTarget({
    directUrl,
    expectedEndpointId,
    runtimeUrl
  });

  return {
    databaseUrl: target.directUrl,
    endpointId: target.endpointId
  };
};

export const wipeDevelopmentDatabase = async () => {
  loadDevelopmentResetEnv();
  const { databaseUrl } = readDevelopmentWipeConfig(process.env);
  const client = new Client({
    application_name: "loresafe-development-database-wipe",
    connectionString: databaseUrl
  });

  console.log("Development Neon wipe target verified.");

  try {
    await client.connect();
    await truncateDevelopmentData(client);
  } finally {
    await client.end();
  }

  console.log(
    "Development database wipe completed; Prisma migration history was preserved and no seed was run."
  );
};

const requireDatabaseUrl = (value: string | undefined, envName: string) => {
  const databaseUrl = value?.trim();

  if (!databaseUrl) {
    throw new DevelopmentDatabaseWipeError(
      `Refusing to wipe the development database without ${envName}.`
    );
  }

  return databaseUrl;
};

const isDirectRun = () =>
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun()) {
  wipeDevelopmentDatabase().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Development database wipe failed: ${message}`);
    process.exit(1);
  });
}
