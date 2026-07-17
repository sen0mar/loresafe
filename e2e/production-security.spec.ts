import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const demoEmail = process.env.DEMO_USER_EMAIL ?? "browser-demo@example.com";
const demoPassword = process.env.DEMO_USER_PASSWORD ?? "browser-demo-password";
const demoDisplayName =
  process.env.DEMO_USER_DISPLAY_NAME ?? "Browser Demo Reader";
const clubLinkName = "the-first-law-book-club";
const browserOrigin = "http://127.0.0.1:4173";

test.describe.configure({ mode: "serial" });

test("protects auth cookies, rejects cross-origin writes, and passes primary accessibility checks", async ({
  page
}) => {
  await page.goto("/");
  await expectNoSeriousAccessibilityViolations(page);

  await loginAsDemo(page);

  const authCookies = (await page.context().cookies()).filter((cookie) =>
    cookie.name.includes("loresafe")
  );

  expect(authCookies.length).toBeGreaterThanOrEqual(2);
  expect(authCookies.every((cookie) => cookie.httpOnly)).toBe(true);
  expect(authCookies.every((cookie) => cookie.sameSite === "Lax")).toBe(true);
  await expectNoSeriousAccessibilityViolations(page);

  const rejectedLogout = await page.context().request.post("/api/auth/logout", {
    headers: { Origin: "https://evil.example" }
  });

  expect(rejectedLogout.status()).toBe(403);
  await expect(page.getByText(demoDisplayName).first()).toBeVisible();
});

test("keeps locked content and media metadata out of the browser after rewind", async ({
  page
}) => {
  await loginAsDemo(page);
  await page.goto(`/app/clubs/${clubLinkName}?tab=progress`);
  await completeWelcomeSetupIfNeeded(page);

  await page.getByRole("button", { name: "Previous milestone" }).click();
  await expect(
    page.getByText(/Future discussions are locked again/i)
  ).toBeVisible();

  await page.getByRole("tab", { name: "Feed" }).click();
  const lockedFeedResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/clubs/${clubLinkName}/posts`) &&
      response.url().includes("tab=locked") &&
      response.ok()
  );
  await page.getByRole("tab", { name: "Locked" }).click();

  const lockedPayload = JSON.stringify(await (await lockedFeedResponse).json());

  expect(lockedPayload).not.toContain("LOCKED_DEMO_SECRET_BODY_DO_NOT_LEAK");
  expect(lockedPayload).not.toContain("LOCKED_FINALE_SECRET_BODY_DO_NOT_LEAK");
  expect(lockedPayload).not.toContain("private/post-images/");
  expect(lockedPayload).not.toContain('"media"');
  await expect(page.getByText(/LOCKED_.*_DO_NOT_LEAK/)).toHaveCount(0);

  await page.getByRole("tab", { name: "Progress" }).click();
  await page.getByRole("button", { name: "Next milestone complete" }).click();
});

test("denies a banned member and verifies upload CORS at the browser boundary", async ({
  browser,
  page
}) => {
  const suffix = `${Date.now()}`.slice(-8);
  const memberUsername = `browser_${suffix}`;
  const memberContext = await browser.newContext({ baseURL: browserOrigin });

  try {
    const signupResponse = await memberContext.request.post(
      "/api/auth/signup",
      {
        data: {
          email: `${memberUsername}@example.com`,
          username: memberUsername,
          password: "browser-member-password"
        },
        headers: { Origin: browserOrigin }
      }
    );
    expect(signupResponse.status()).toBe(201);

    const joinResponse = await memberContext.request.post(
      `/api/clubs/${clubLinkName}/join`,
      { headers: { Origin: browserOrigin } }
    );
    expect(joinResponse.ok()).toBe(true);

    await loginAsDemo(page);
    const membersResponse = await page
      .context()
      .request.get(`/api/clubs/${clubLinkName}/members?page=1&limit=50`);
    const membersPayload = (await membersResponse.json()) as {
      members: Array<{ id: string; user: { username: string | null } }>;
    };
    const member = membersPayload.members.find(
      (candidate) => candidate.user.username === memberUsername
    );

    expect(member).toBeDefined();
    const banResponse = await page
      .context()
      .request.post(`/api/clubs/${clubLinkName}/members/${member?.id}/ban`, {
        data: {
          reason: "Browser security regression",
          deleteAuthoredPosts: false
        },
        headers: { Origin: browserOrigin }
      });
    expect(banResponse.ok()).toBe(true);

    const bannedRead = await memberContext.request.get(
      `/api/clubs/${clubLinkName}`
    );
    expect(bannedRead.status()).toBe(403);

    const corsPreflight = await page
      .context()
      .request.fetch("/api/uploads/post-images", {
        method: "OPTIONS",
        headers: {
          Origin: browserOrigin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type"
        }
      });

    expect(corsPreflight.ok()).toBe(true);
    expect(corsPreflight.headers()["access-control-allow-origin"]).toBe(
      browserOrigin
    );
    expect(corsPreflight.headers()["access-control-allow-credentials"]).toBe(
      "true"
    );
  } finally {
    await memberContext.close();
  }
});

test("avoids automatic event streams and rejects protected API reads after logout", async ({
  page
}) => {
  const suffix = `${Date.now()}`.slice(-8);
  const username = `idle_${suffix}`;
  const email = `${username}@example.com`;
  const password = "browser-idle-password";
  const signupResponse = await page.context().request.post("/api/auth/signup", {
    data: { email, username, password },
    headers: { Origin: browserOrigin }
  });

  expect(signupResponse.status()).toBe(201);

  try {
    const eventRequests: string[] = [];

    page.on("request", (request) => {
      if (request.url().includes("/api/events")) {
        eventRequests.push(request.url());
      }
    });

    await page.goto("/app");
    await page.waitForLoadState("networkidle");
    expect(eventRequests).toEqual([]);
    await page.getByRole("button", { name: new RegExp(username) }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    const revokedNotificationRead = await page
      .context()
      .request.get("/api/notifications?limit=1");

    expect(revokedNotificationRead.status()).toBe(401);
  } finally {
    const loginResponse = await page.context().request.post("/api/auth/login", {
      data: { email, password },
      headers: { Origin: browserOrigin }
    });

    if (loginResponse.ok()) {
      await page.context().request.delete("/api/users/me", {
        data: { confirmation: "delete", password },
        headers: { Origin: browserOrigin }
      });
    }
  }
});

const loginAsDemo = async (page: Page) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(demoEmail);
  await page.getByLabel("Password", { exact: true }).fill(demoPassword);
  await page.getByRole("button", { name: /^log in/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(demoDisplayName).first()).toBeVisible();
};

const completeWelcomeSetupIfNeeded = async (page: Page) => {
  const saveSetupButton = page.getByRole("button", { name: "Save setup" });

  if (await saveSetupButton.isVisible()) {
    await saveSetupButton.click();
    await expect(saveSetupButton).not.toBeVisible();
  }
};

const expectNoSeriousAccessibilityViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious"
  );

  expect(seriousViolations).toEqual([]);
};
