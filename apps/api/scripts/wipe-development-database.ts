import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  loadDevelopmentResetEnv,
  truncateDevelopmentData
} from "./reset-development-database.js";

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

type NeonDatabaseIdentity = {
  databaseName: string;
  endpointId: string;
  pooled: boolean;
  username: string;
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
  const runtimeIdentity = readNeonDatabaseIdentity(runtimeUrl, "DATABASE_URL");
  const directIdentity = readNeonDatabaseIdentity(directUrl, "DIRECT_URL");

  if (directIdentity.pooled) {
    throw new DevelopmentDatabaseWipeError(
      "DIRECT_URL must use the direct Neon endpoint, not the pooled endpoint."
    );
  }

  assertMatchingIdentities(runtimeIdentity, directIdentity);

  if (directIdentity.endpointId !== expectedEndpointId) {
    throw new DevelopmentDatabaseWipeError(
      "DIRECT_URL does not match DEV_DATABASE_WIPE_NEON_ENDPOINT_ID."
    );
  }

  return {
    databaseUrl: directUrl,
    endpointId: directIdentity.endpointId
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

const readNeonDatabaseIdentity = (
  value: string,
  envName: string
): NeonDatabaseIdentity => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new DevelopmentDatabaseWipeError(
      `${envName} must be a valid PostgreSQL URL.`
    );
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DevelopmentDatabaseWipeError(
      `${envName} must be a valid PostgreSQL URL.`
    );
  }

  const hostname = url.hostname.toLowerCase();

  if (!hostname.endsWith(".neon.tech")) {
    throw new DevelopmentDatabaseWipeError(
      `${envName} must target a Neon database.`
    );
  }

  const endpointLabel = hostname.split(".")[0] ?? "";
  const pooled = endpointLabel.endsWith("-pooler");
  const endpointId = pooled
    ? endpointLabel.slice(0, -"-pooler".length)
    : endpointLabel;
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const username = decodeURIComponent(url.username);

  if (!/^ep-[a-z0-9-]+$/.test(endpointId) || !databaseName || !username) {
    throw new DevelopmentDatabaseWipeError(
      `${envName} must include a Neon endpoint, database, and username.`
    );
  }

  return {
    databaseName,
    endpointId,
    pooled,
    username
  };
};

const assertMatchingIdentities = (
  runtimeIdentity: NeonDatabaseIdentity,
  directIdentity: NeonDatabaseIdentity
) => {
  const identitiesMatch =
    runtimeIdentity.endpointId === directIdentity.endpointId &&
    runtimeIdentity.databaseName === directIdentity.databaseName &&
    runtimeIdentity.username === directIdentity.username;

  if (!identitiesMatch) {
    throw new DevelopmentDatabaseWipeError(
      "DATABASE_URL and DIRECT_URL must identify the same Neon endpoint, database, and username."
    );
  }
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
