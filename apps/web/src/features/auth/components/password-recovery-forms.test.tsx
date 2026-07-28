import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getJsonRequestBody,
  mockFetchRoutes,
  renderWithProviders
} from "@/test/render";

import {
  ForgotPasswordForm,
  ResetPasswordForm,
  VerifyEmailCard
} from "./password-recovery-forms.js";

const token = "t".repeat(43);

describe("password recovery and verification forms", () => {
  it("submits the neutral forgot-password request", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/password/forgot",
        response: {
          message: "If the account is eligible, an email has been sent."
        },
        status: 202
      }
    ]);
    renderWithProviders(<ForgotPasswordForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "Reader@Example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await screen.findByText(
      "If the account is eligible, an email has been sent."
    );
    expect(getJsonRequestBody(fetchMock.mock.calls[0] ?? [])).toEqual({
      email: "reader@example.com"
    });
  });

  it("submits a password reset token and new password", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/password/reset",
        response: { message: "Request completed." }
      }
    ]);
    renderWithProviders(<ResetPasswordForm />, {
      initialEntries: [`/reset-password?token=${token}`]
    });
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("New password"),
      "new correct horse battery staple"
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await screen.findByText("Your request is complete.");
    expect(getJsonRequestBody(fetchMock.mock.calls[0] ?? [])).toEqual({
      token,
      password: "new correct horse battery staple"
    });
  });

  it("confirms an email token on mount", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/verification/confirm",
        response: { message: "Request completed." }
      }
    ]);
    renderWithProviders(<VerifyEmailCard />, {
      initialEntries: [`/verify-email?token=${token}`]
    });

    await screen.findByText("Your request is complete. You can now log in.");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(getJsonRequestBody(fetchMock.mock.calls[0] ?? [])).toEqual({
      token
    });
  });
});
