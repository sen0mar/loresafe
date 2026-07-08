import { describe, expect, it } from "vitest";

import { isDatabaseConnectivityError } from "./errors.js";

describe("Prisma error helpers", () => {
  it("recognizes database connectivity errors", () => {
    expect(
      isDatabaseConnectivityError({
        code: "P1001",
        message:
          "Can't reach database server at ep-patient-thunder-apqqxlnj-pooler.c-7.us-east-1.aws.neon.tech"
      })
    ).toBe(true);

    expect(
      isDatabaseConnectivityError({
        name: "PrismaClientInitializationError",
        message: "Timed out while opening a database connection."
      })
    ).toBe(true);
  });

  it("does not classify unrelated Prisma errors as connectivity failures", () => {
    expect(
      isDatabaseConnectivityError({
        code: "P2002",
        message: "Unique constraint failed."
      })
    ).toBe(false);
  });
});
