import { env } from "../../config/env.js";
import { logger } from "../../core/logging/logger.js";

export type EmailDelivery = {
  sendEmailVerification: (input: {
    email: string;
    token: string;
    expiresAt: Date;
  }) => Promise<void>;
  sendPasswordReset: (input: {
    email: string;
    token: string;
    expiresAt: Date;
  }) => Promise<void>;
};

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailTransport = (email: OutgoingEmail) => Promise<void>;

type EmailKind = "verification" | "password_reset";

const resendEndpoint = "https://api.resend.com/emails";
const deliveryTimeoutMs = 10_000;

export class EmailDeliveryError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Email provider responded with status ${status}`);
    this.name = "EmailDeliveryError";
    this.status = status;
  }
}

export const createResendTransport = ({
  apiKey,
  from,
  fetchImpl = fetch
}: {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
}): EmailTransport => {
  return async ({ to, subject, text, html }) => {
    const response = await fetchImpl(resendEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(deliveryTimeoutMs)
    });

    if (!response.ok) {
      throw new EmailDeliveryError(response.status);
    }
  };
};

export const createEmailDelivery = ({
  transport,
  linkOrigin,
  appName
}: {
  transport: EmailTransport;
  linkOrigin: string;
  appName: string;
}): EmailDelivery => {
  const send = async (kind: EmailKind, email: OutgoingEmail) => {
    try {
      await transport(email);
    } catch (error) {
      // Never log the recipient, link, or token; the kind and status are enough
      // to spot provider outages, quota limits, or a bad API key.
      logger.warn("Email delivery failed", {
        emailKind: kind,
        providerStatus:
          error instanceof EmailDeliveryError ? error.status : undefined,
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
    }
  };

  return {
    sendEmailVerification: ({ email, token, expiresAt }) =>
      send(
        "verification",
        renderEmail({
          to: email,
          appName,
          subject: `Verify your email for ${appName}`,
          intro: `Confirm this email address to finish creating your ${appName} account.`,
          action: "Verify email",
          link: buildLink(linkOrigin, "/verify-email", token),
          expiresAt,
          ignoreNote:
            "If you did not sign up, ignore this email and no account will be created."
        })
      ),
    sendPasswordReset: ({ email, token, expiresAt }) =>
      send(
        "password_reset",
        renderEmail({
          to: email,
          appName,
          subject: `Reset your ${appName} password`,
          intro: `Use this link to choose a new password for your ${appName} account.`,
          action: "Reset password",
          link: buildLink(linkOrigin, "/reset-password", token),
          expiresAt,
          ignoreNote:
            "If you did not ask for a reset, ignore this email; your password stays the same."
        })
      )
  };
};

// Used when no provider is configured (local development and tests): nothing is
// sent, and raw tokens are never logged or returned.
export const disabledEmailDelivery: EmailDelivery = {
  sendEmailVerification: async () => undefined,
  sendPasswordReset: async () => undefined
};

const buildLink = (origin: string, path: string, token: string) => {
  const url = new URL(path, origin);
  url.searchParams.set("token", token);
  return url.toString();
};

const formatLifetime = (expiresAt: Date) => {
  const hours = Math.max(
    1,
    Math.round((expiresAt.getTime() - Date.now()) / (60 * 60 * 1000))
  );

  return hours === 1 ? "1 hour" : `${hours} hours`;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderEmail = ({
  to,
  appName,
  subject,
  intro,
  action,
  link,
  expiresAt,
  ignoreNote
}: {
  to: string;
  appName: string;
  subject: string;
  intro: string;
  action: string;
  link: string;
  expiresAt: Date;
  ignoreNote: string;
}): OutgoingEmail => {
  const expiry = `This link expires in ${formatLifetime(expiresAt)}.`;

  return {
    to,
    subject,
    text: [intro, "", `${action}: ${link}`, "", expiry, ignoreNote].join("\n"),
    html: `<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1f2933;">
    <p>${escapeHtml(intro)}</p>
    <p><a href="${escapeHtml(link)}" style="display: inline-block; padding: 10px 16px; background: #1f2933; color: #ffffff; text-decoration: none; border-radius: 6px;">${escapeHtml(action)}</a></p>
    <p style="font-size: 14px;">Or open this link: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <p style="font-size: 14px;">${escapeHtml(expiry)} ${escapeHtml(ignoreNote)}</p>
    <p style="font-size: 12px; color: #616e7c;">${escapeHtml(appName)}</p>
  </body>
</html>`
  };
};

const createDefaultEmailDelivery = (): EmailDelivery => {
  if (env.NODE_ENV === "test" || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return disabledEmailDelivery;
  }

  return createEmailDelivery({
    transport: createResendTransport({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM
    }),
    linkOrigin:
      env.NODE_ENV === "production"
        ? env.PUBLIC_SITE_ORIGIN
        : env.CLIENT_ORIGIN,
    appName: env.APP_NAME
  });
};

export const emailDelivery: EmailDelivery = createDefaultEmailDelivery();
