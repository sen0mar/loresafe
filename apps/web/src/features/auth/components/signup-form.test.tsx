import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockFetchRoutes, renderWithProviders } from "@/test/render";

import { SignupForm } from "./signup-form";

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return { ...actual, toast: { ...actual.toast, success: vi.fn() } };
});

describe("signup form", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the check-your-email toast up long enough and mentions spam", async () => {
    const user = userEvent.setup();
    mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/signup",
        status: 202,
        response: {
          message: "If the account is eligible, an email has been sent."
        }
      }
    ]);
    const routeObserver = vi.fn();
    renderWithProviders(<SignupForm />, {
      initialEntries: ["/signup"],
      routeObserver
    });

    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.type(screen.getByLabelText("Username"), "new_reader");
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "correct horse battery staple"
    );
    await user.type(
      screen.getByLabelText("Confirm password"),
      "correct horse battery staple"
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith(
      "Check your email for a link to finish creating your account",
      {
        description:
          "It can take a few minutes. If you don't see it, check your spam or junk folder.",
        duration: 20_000,
        closeButton: true
      }
    );
    expect(routeObserver).toHaveBeenLastCalledWith("/login");
  });
});
