import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getJsonRequestBody,
  mockFetchRoutes,
  renderWithProviders
} from "@/test/render";

import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

const { demoCredentials } = vi.hoisted(() => ({
  demoCredentials: {
    current: {
      email: "guest@example.com",
      password: "demo-password"
    } as { email: string; password: string } | null
  }
}));

vi.mock("../config/demo-login.js", () => ({
  getDemoLoginCredentials: () => demoCredentials.current
}));

const authUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "guest@example.com",
  displayName: "Demo Reader",
  username: "demo_reader",
  bio: null,
  avatarUrl: null,
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z"
};

beforeEach(() => {
  demoCredentials.current = {
    email: "guest@example.com",
    password: "demo-password"
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo login forms", () => {
  it("hides the guest action when public demo credentials are unavailable", () => {
    demoCredentials.current = null;

    renderWithProviders(<LoginForm />, { initialEntries: ["/login"] });

    expect(
      screen.queryByRole("button", { name: "Continue as guest" })
    ).not.toBeInTheDocument();
  });

  it.each([
    ["login", <LoginForm />],
    ["signup", <SignupForm />]
  ])(
    "logs in from the %s form and preserves the safe redirect",
    async (_, form) => {
      const fetchMock = mockFetchRoutes([
        {
          method: "POST",
          path: "/api/auth/login",
          response: { user: authUser }
        }
      ]);
      const routeChanges: string[] = [];
      const renderedForm = renderWithProviders(form, {
        initialEntries: ["/login?redirectTo=/app/clubs/demo-club"],
        routeObserver: (path) => routeChanges.push(path)
      });

      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Continue as guest" }));

      await waitFor(() =>
        expect(routeChanges.at(-1)).toBe("/app/clubs/demo-club")
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          credentials: "include",
          method: "POST"
        })
      );
      expect(getJsonRequestBody(fetchMock.mock.calls[0])).toEqual({
        email: "guest@example.com",
        password: "demo-password"
      });

      renderedForm.unmount();
    }
  );

  it("disables the signup fields and shows a loading label while opening the demo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined))
    );
    renderWithProviders(<SignupForm />, { initialEntries: ["/signup"] });

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Continue as guest" }));

    expect(
      screen.getByRole("button", { name: "Opening demo..." })
    ).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeDisabled();
  });

  it.each([
    ["login", <LoginForm />],
    ["signup", <SignupForm />]
  ])(
    "shows the normal login error on the %s form when demo credentials are rejected",
    async (_, form) => {
      mockFetchRoutes([
        {
          method: "POST",
          path: "/api/auth/login",
          response: {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Invalid credentials"
            }
          },
          status: 401
        }
      ]);
      renderWithProviders(form, { initialEntries: ["/login"] });

      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Continue as guest" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Invalid credentials"
      );
    }
  );
});
