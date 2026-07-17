export type NeonDatabaseTarget = {
  databaseName: string;
  directUrl: string;
  endpointId: string;
  username: string;
};

type NeonDatabaseIdentity = Omit<NeonDatabaseTarget, "directUrl"> & {
  pooled: boolean;
};

export const readMatchingNeonDatabaseTarget = ({
  directUrl,
  expectedEndpointId,
  runtimeUrl
}: {
  directUrl: string;
  expectedEndpointId: string;
  runtimeUrl: string;
}): NeonDatabaseTarget => {
  const runtimeIdentity = readNeonDatabaseIdentity(runtimeUrl, "DATABASE_URL");
  const directIdentity = readNeonDatabaseIdentity(directUrl, "DIRECT_URL");

  if (directIdentity.pooled) {
    throw new Error(
      "DIRECT_URL must use the direct Neon endpoint, not the pooled endpoint."
    );
  }

  const identitiesMatch =
    runtimeIdentity.endpointId === directIdentity.endpointId &&
    runtimeIdentity.databaseName === directIdentity.databaseName &&
    runtimeIdentity.username === directIdentity.username;

  if (!identitiesMatch) {
    throw new Error(
      "DATABASE_URL and DIRECT_URL must identify the same Neon endpoint, database, and username."
    );
  }

  if (directIdentity.endpointId !== expectedEndpointId) {
    throw new Error("DIRECT_URL does not match the approved Neon endpoint ID.");
  }

  return {
    databaseName: directIdentity.databaseName,
    directUrl,
    endpointId: directIdentity.endpointId,
    username: directIdentity.username
  };
};

const readNeonDatabaseIdentity = (
  value: string,
  envName: string
): NeonDatabaseIdentity => {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`${envName} must be a valid PostgreSQL URL.`);
  }

  const hostname = url.hostname.toLowerCase();

  if (!hostname.endsWith(".neon.tech")) {
    throw new Error(`${envName} must target a Neon database.`);
  }

  const endpointLabel = hostname.split(".")[0] ?? "";
  const pooled = endpointLabel.endsWith("-pooler");
  const endpointId = pooled
    ? endpointLabel.slice(0, -"-pooler".length)
    : endpointLabel;
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  const username = decodeURIComponent(url.username);

  if (!/^ep-[a-z0-9-]+$/.test(endpointId) || !databaseName || !username) {
    throw new Error(
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
