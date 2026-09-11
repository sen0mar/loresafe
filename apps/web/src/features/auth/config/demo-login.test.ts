import { describe, expect, it } from "vitest";

import { getDemoLoginCredentials } from "./demo-login";

describe("demo login configuration", () => {
  it("returns normalized credentials when both values are valid", () => {
    expect(
      getDemoLoginCredentials({
        VITE_DEMO_USER_EMAIL: " Guest@Example.com ",
        VITE_DEMO_USER_PASSWORD: "demo-password"
      })
    ).toEqual({
      email: "guest@example.com",
      password: "demo-password"
    });
  });

  it.each([
    {},
    { VITE_DEMO_USER_EMAIL: "guest@example.com" },
    { VITE_DEMO_USER_PASSWORD: "demo-password" },
    {
      VITE_DEMO_USER_EMAIL: "not-an-email",
      VITE_DEMO_USER_PASSWORD: "demo-password"
    }
  ])("returns null for incomplete or invalid configuration", (env) => {
    expect(getDemoLoginCredentials(env)).toBeNull();
  });
});
