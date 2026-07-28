import { LegalPageLayout } from "../components/legal-page-layout.js";

const policyVersion = "1.0";
const effectiveDate = "July 28, 2026";

export const PrivacyPolicyPage = () => (
  <LegalPageLayout
    title="Privacy Policy"
    description="This policy explains the information LoreSafe handles to provide spoiler-safe clubs, protect accounts, moderate communities, and operate the service. It is product information, not legal advice."
    version={policyVersion}
    effectiveDate={effectiveDate}
    sections={privacySections}
  />
);

const privacySections = [
  {
    title: "Information LoreSafe handles",
    content: (
      <>
        <p>LoreSafe processes the following categories when you use them:</p>
        <ul>
          <li>
            Account and profile data, including email, username, display name,
            biography, password hash, verification state, and avatar metadata.
          </li>
          <li>
            Session and security data, including hashed session identifiers,
            token-family history, security events, request IDs, IP addresses
            used for abuse controls, and rate-limit counters.
          </li>
          <li>
            Club activity, including memberships, roles, bans, invites,
            progress, reading mode, posts, comments, reactions, predictions,
            notifications, reports, and moderation actions.
          </li>
          <li>
            Uploaded media and its storage metadata, such as file type, size,
            dimensions, ownership, visibility, and spoiler requirements.
          </li>
          <li>
            Operational diagnostics, including minimized application errors,
            performance traces, browser/device context, and deployment health.
          </li>
        </ul>
      </>
    )
  },
  {
    title: "Why the information is used",
    content: (
      <ul>
        <li>
          Create and secure accounts, verify email, recover passwords, and keep
          sessions revocable.
        </li>
        <li>
          Enforce membership, progress, spoiler visibility, moderation, bans,
          and private-media access on the backend.
        </li>
        <li>
          Deliver requested club features, notifications, uploads, and account
          settings.
        </li>
        <li>
          Prevent abuse through rate limiting, investigate security incidents,
          preserve audit accountability, diagnose failures, and recover data.
        </li>
      </ul>
    )
  },
  {
    title: "Cookies and browser storage",
    content: (
      <>
        <p>
          LoreSafe uses Secure, HttpOnly cookies for the access session and
          rotating refresh token. These cookies are required for sign-in and are
          not available to frontend JavaScript.
        </p>
        <p>
          Local storage holds only small interface preferences, including the
          desktop sidebar choice, and a non-secret hint that avoids an
          unnecessary signed-out session check. The hint is not an auth token
          and does not authenticate anyone. LoreSafe does not currently use
          advertising cookies or cross-site marketing trackers.
        </p>
      </>
    )
  },
  {
    title: "Providers",
    content: (
      <p>
        LoreSafe relies on Vercel for the public web app, Render for the API,
        Neon for managed PostgreSQL, Cloudflare R2 for uploaded media, Upstash
        Redis for rate-limit counters, and Sentry for configured error and
        performance monitoring. Each provider handles only the information
        needed for its service and applies its own infrastructure and retention
        settings.
      </p>
    )
  },
  {
    title: "Public content, private media, and moderation",
    content: (
      <>
        <p>
          Public club metadata may be visible without an account. Club content
          is still shaped by membership and progress rules. Private or
          spoiler-sensitive media is delivered only after backend authorization;
          public avatars and club covers can be publicly retrievable after
          validation.
        </p>
        <p>
          Reports, moderator notes, bans, and audit records are restricted to
          backend operations and authorized moderation flows. Audit logs are not
          exposed as a general user or public API.
        </p>
      </>
    )
  },
  {
    title: "Retention, deletion, and backups",
    content: (
      <>
        <ul>
          <li>
            Active account and club data remains while the account or content is
            needed to provide the service, unless you delete it sooner.
          </li>
          <li>
            Spent refresh-token hashes expire after 24 hours. Revoked sessions
            remain only as needed for session expiry and security enforcement.
          </li>
          <li>
            Moderation audit logs are retained for 365 days, then removed in
            bounded request-driven batches. When an account is deleted, its
            actor name snapshots are anonymized immediately where operationally
            safe.
          </li>
          <li>
            Rate-limit counters expire with their configured protection window.
            Sentry diagnostics follow the configured Sentry project retention.
          </li>
          <li>
            PostgreSQL backups and R2 recovery versions are retained for at
            least 14 days. Deleted information may remain in protected backups
            until the applicable recovery window expires and is not restored
            except for disaster recovery.
          </li>
        </ul>
        <p>
          Account deletion removes the active profile, posts, comments,
          sessions, notifications, and owned file metadata. Limited, anonymized
          audit history and time-limited recovery copies are the documented
          exceptions.
        </p>
      </>
    )
  },
  {
    title: "Your choices and requests",
    content: (
      <>
        <p>
          You can update supported profile fields, manage notifications and club
          activity, or delete your account in Profile settings. Depending on
          where you live, you may also have rights to ask about, access,
          correct, delete, restrict, or export personal information.
        </p>
        <p>
          Contact <a href="mailto:privacy@loresafe.org">privacy@loresafe.org</a>{" "}
          for a privacy request. LoreSafe may need to verify that the request
          belongs to you. Never send a password, session token, or private
          upload link.
        </p>
      </>
    )
  },
  {
    title: "Policy changes",
    content: (
      <p>
        The version and effective date above change when this policy changes.
        Material changes will be presented through the site or account
        experience before they take effect when practical. Earlier versions
        should be retained with release records.
      </p>
    )
  }
];
