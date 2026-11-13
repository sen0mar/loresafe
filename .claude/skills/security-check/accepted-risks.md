# Accepted risks

Items here are reported under "Accepted risks", not as findings. Add an entry
only when the user decides to accept a risk; include the date and the reason.

- **Public demo credentials** (`VITE_DEMO_USER_EMAIL` / `VITE_DEMO_USER_PASSWORD`
  are shipped in the web build by design). Accepted on the condition that the
  demo account is isolated and has no elevated roles outside seeded demo
  clubs; `live` verifies that condition. Source:
  `context/architecture/auth-and-access.md`.
- **`style-src 'unsafe-inline'`** in the CSP. Existing design choice; flag only
  if `script-src` is weakened.
- **`img-src https:`** in the CSP. Existing design choice for media hosts.
