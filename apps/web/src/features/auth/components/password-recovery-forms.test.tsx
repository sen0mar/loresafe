import { useNavigate } from "react-router-dom";
import { act, screen, waitFor } from "@testing-library/react";
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
    const routeObserver = vi.fn();
    const HistoryBack = () => {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>History back</button>;
    };
    renderWithProviders(
      <>
        <ResetPasswordForm />
        <HistoryBack />
      </>,
      {
        initialEntries: [
          "/login",
          `/reset-password?token=${token}&source=email`
        ],
        routeObserver
      }
    );
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("New password"),
      "new correct horse battery staple"
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await screen.findByText("Your request is complete.");
    await waitFor(() =>
      expect(routeObserver).toHaveBeenLastCalledWith(
        "/reset-password?source=email"
      )
    );
    expect(getJsonRequestBody(fetchMock.mock.calls[0] ?? [])).toEqual({
      token,
      password: "new correct horse battery staple"
    });
    await user.click(screen.getByRole("button", { name: "History back" }));
    expect(routeObserver).toHaveBeenLastCalledWith("/login");
  });

  it("confirms an email token on mount", async () => {
    const fetchMock = mockFetchRoutes([
      {
        method: "POST",
        path: "/api/auth/verification/confirm",
        response: { message: "Request completed." }
      }
    ]);
    const routeObserver = vi.fn();
    renderWithProviders(<VerifyEmailCard />, {
      initialEntries: [`/verify-email?token=${token}&source=email`],
      routeObserver
    });

    await screen.findByText("Your request is complete. You can now log in.");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(routeObserver).toHaveBeenLastCalledWith(
      "/verify-email?source=email"
    );
    expect(getJsonRequestBody(fetchMock.mock.calls[0] ?? [])).toEqual({
      token
    });
  });
});

it("preserves a reset token after a failed attempt for retry", async () => {
  mockFetchRoutes([
    {
      method: "POST",
      path: "/api/auth/password/reset",
      status: 503,
      response: { error: { message: "Please retry", code: "UNAVAILABLE" } }
    }
  ]);
  const routeObserver = vi.fn();
  renderWithProviders(<ResetPasswordForm />, {
    initialEntries: [`/reset-password?token=${token}`],
    routeObserver
  });
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("New password"),
    "new correct horse battery staple"
  );
  await user.click(screen.getByRole("button", { name: "Reset password" }));
  await screen.findByText("Please retry");
  expect(routeObserver).toHaveBeenLastCalledWith(
    `/reset-password?token=${token}`
  );
  expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
});

it("keeps the verification URL after a failed confirmation", async () => {
  mockFetchRoutes([
    {
      method: "POST",
      path: "/api/auth/verification/confirm",
      status: 503,
      response: {
        error: { message: "Please retry verification", code: "UNAVAILABLE" }
      }
    }
  ]);
  const routeObserver = vi.fn();
  renderWithProviders(<VerifyEmailCard />, {
    initialEntries: [`/verify-email?token=${token}`],
    routeObserver
  });
  await screen.findByText("Please retry verification");
  expect(routeObserver).toHaveBeenLastCalledWith(
    `/verify-email?token=${token}`
  );
});

it("sends verification once across pending rerenders and removes the consumed token", async () => {
  let resolve!: (response: Response) => void;
  const request = new Promise<Response>((done) => {
    resolve = done;
  });
  const fetchMock = vi.fn(() => request);
  vi.stubGlobal("fetch", fetchMock);
  const routeObserver = vi.fn();
  const { rerender } = renderWithProviders(<VerifyEmailCard />, {
    initialEntries: [`/verify-email?token=${token}&source=email`],
    routeObserver
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  rerender(<VerifyEmailCard />);
  expect(fetchMock).toHaveBeenCalledOnce();
  await act(async () => {
    resolve(
      new Response(JSON.stringify({ message: "Request completed." }), {
        headers: { "Content-Type": "application/json" }
      })
    );
  });
  await screen.findByText("Your request is complete. You can now log in.");
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(routeObserver).toHaveBeenLastCalledWith("/verify-email?source=email");
  vi.unstubAllGlobals();
});
