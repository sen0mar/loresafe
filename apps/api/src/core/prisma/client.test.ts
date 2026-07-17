import { describe, expect, it, vi } from "vitest";

const constructorSpies = vi.hoisted(() => ({
  adapter: vi.fn(),
  client: vi.fn()
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(databaseUrl: string) {
      constructorSpies.adapter(databaseUrl);
    }
  }
}));

vi.mock("../../generated/prisma/client.js", () => ({
  PrismaClient: class {
    constructor() {
      constructorSpies.client();
    }

    $transaction = vi.fn();
  }
}));

describe("lazy Prisma client", () => {
  it("does not construct a PostgreSQL adapter or Prisma client on import", async () => {
    const { prisma } = await import("./client.js");

    expect(constructorSpies.adapter).not.toHaveBeenCalled();
    expect(constructorSpies.client).not.toHaveBeenCalled();

    void prisma.$transaction;
    void prisma.$transaction;

    expect(constructorSpies.adapter).toHaveBeenCalledTimes(1);
    expect(constructorSpies.client).toHaveBeenCalledTimes(1);
  });
});
