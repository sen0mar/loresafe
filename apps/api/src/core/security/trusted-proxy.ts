import type { Express } from "express";

export const configureTrustedProxy = (
  app: Pick<Express, "set">,
  trustedProxyCidrs: string[]
) => {
  app.set(
    "trust proxy",
    trustedProxyCidrs.length > 0 ? trustedProxyCidrs : false
  );
};
