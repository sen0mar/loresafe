import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/render";

import { PrivacyPolicyPage } from "./privacy-policy-page.js";
import { TermsPage } from "./terms-page.js";

describe("public legal pages", () => {
  it("publishes provider, retention, deletion, and contact disclosures", () => {
    renderWithProviders(<PrivacyPolicyPage />);

    expect(
      screen.getByRole("heading", { name: "Privacy Policy" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Vercel for the public web app/)
    ).toBeInTheDocument();
    expect(screen.getByText(/retained for 365 days/)).toBeInTheDocument();
    expect(screen.getByText(/at least 14 days/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "privacy@loresafe.org" })
    ).toHaveAttribute("href", "mailto:privacy@loresafe.org");
  });

  it("publishes versioned terms without presenting legal advice", () => {
    renderWithProviders(<TermsPage />);

    expect(
      screen.getByRole("heading", { name: "Terms of Use" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Version 1.0/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No legal or professional advice" })
    ).toBeInTheDocument();
  });
});
