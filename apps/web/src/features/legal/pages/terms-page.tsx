import { LegalPageLayout } from "../components/legal-page-layout.js";

export const TermsPage = () => (
  <LegalPageLayout
    title="Terms of Use"
    description="These terms describe the current LoreSafe product rules. They are practical service terms and are not legal advice."
    version="1.0"
    effectiveDate="July 28, 2026"
    sections={termsSections}
  />
);

const termsSections = [
  {
    title: "Using LoreSafe",
    content: (
      <p>
        You must provide accurate account information, protect your sign-in
        credentials, and use LoreSafe only in ways permitted by applicable law
        and these terms. You are responsible for activity performed through your
        account until you report or secure unauthorized access.
      </p>
    )
  },
  {
    title: "Community and spoiler safety",
    content: (
      <ul>
        <li>
          Set honest progress and attach posts, comments, and media to an
          appropriate milestone.
        </li>
        <li>
          Do not harass others, evade bans, spam, impersonate people, upload
          malicious material, or attempt to bypass authorization.
        </li>
        <li>
          Club owners and moderators may adjust spoiler levels, hide or delete
          content, warn members, resolve reports, and ban accounts within their
          authorized clubs.
        </li>
      </ul>
    )
  },
  {
    title: "Your content",
    content: (
      <>
        <p>
          You keep responsibility for content you submit and must have
          permission to share it. You give LoreSafe the limited permission
          needed to store, process, display, moderate, and deliver that content
          through the service according to club visibility and spoiler rules.
        </p>
        <p>
          Do not treat a public club, public avatar, or public club cover as
          private. Private and spoiler-sensitive content still depends on
          account and progress controls described in the Privacy Policy.
        </p>
      </>
    )
  },
  {
    title: "Account action and availability",
    content: (
      <p>
        LoreSafe may limit or suspend access needed to protect users, enforce
        club bans, respond to abuse, maintain security, or keep the service
        reliable. Features may change, and uninterrupted or error-free operation
        is not promised.
      </p>
    )
  },
  {
    title: "Deletion and retained records",
    content: (
      <p>
        You may delete your account after current-password verification and
        resolving sole ownership of any club. Deletion removes active account
        content as described in the Privacy Policy, while limited anonymized
        audit history and protected recovery copies may remain for their stated
        retention windows.
      </p>
    )
  },
  {
    title: "No legal or professional advice",
    content: (
      <p>
        LoreSafe is a discussion product. Content from LoreSafe, its users, or
        its policies is not legal, medical, financial, or other professional
        advice.
      </p>
    )
  },
  {
    title: "Changes and contact",
    content: (
      <p>
        The version and effective date above identify these terms. Material
        changes will be disclosed through the site or account experience when
        practical. Questions can be sent to{" "}
        <a href="mailto:privacy@loresafe.org">privacy@loresafe.org</a>.
      </p>
    )
  }
];
