# Uploads and storage

Rules: `context/architecture/data-and-storage.md` (Upload Lifecycle).
Code: `apps/api/src/modules/uploads/`, `apps/api/src/core/storage/`.

- **Presigned PUTs target staging only.** In `core/storage/upload-object-keys.ts`
  and `r2-storage.ts`, the signed key must always be under `staging/uploads/`
  and derived server-side from pending metadata. No client-supplied key, path
  segment, or filename may reach the key unescaped (check for `..`, `/`).
- **Signed URL lifetime** must not exceed the persisted upload expiration.
- **Final keys are backend-only.** Only the completion path writes to
  `public/` or `private/` keys, after `image-validation.ts` decode/re-encode
  and metadata stripping. Flag any branch that copies staging bytes to a final
  key without re-encoding, or that trusts the client `Content-Type`.
- **Validation bounds:** max byte size, max pixel dimensions (decompression
  bombs), allowed formats only (no SVG unless sanitized).
- **Authorization at intent and completion:** `uploads.policy.ts` checks
  ownership, club membership, bans, and spoiler requirement at both steps; a
  user cannot complete or attach someone else's asset.
- **Private media.** Post/comment media that may carry spoilers must never get
  a `public/` key or `R2_PUBLIC_BASE_URL` URL; it is served only after the
  spoiler policy passes. Avatars and club covers are the only public assets.
- **Cleanup safety.** Deletion uses the durable ledger; a stale pending
  snapshot cannot delete a newly ready asset; deletion keys are derived from
  metadata, never from request input.
- Never log signed URLs or full object keys tied to private content.
