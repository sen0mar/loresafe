const databaseConnectivityErrorCodes = new Set(["P1001", "P1002"]);

export const isDatabaseConnectivityError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? (error as { code?: unknown }).code : undefined;

  if (typeof code === "string" && databaseConnectivityErrorCodes.has(code)) {
    return true;
  }

  const name = "name" in error ? (error as { name?: unknown }).name : undefined;
  const message =
    "message" in error ? (error as { message?: unknown }).message : undefined;

  return (
    typeof name === "string" &&
    name === "PrismaClientInitializationError" &&
    typeof message === "string" &&
    /database server|connect|connection|timeout/i.test(message)
  );
};
