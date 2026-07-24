# Security policy

## Supported use

This project is designed for one person running it on their own computer. The Next.js
server must remain bound to the loopback-only `localhost:5178` address. It is not designed for public hosting,
multi-user use, untrusted shared computers, or storage of regulated/confidential data.

## Reporting a vulnerability

Do not open a public issue containing exploit details or private data. When GitHub
private vulnerability reporting is enabled, use the repository's **Report a
vulnerability** button. Until then, contact the maintainer privately. Maintainers
should revoke any exposed credential before investigating how it leaked.

## Credential rule

The free local features do not need API keys. Optional provider credentials must be
supplied by the user through Settings. Live connectors store credentials in a
dedicated AES-256-GCM encrypted local file. Credentials must never be placed in source,
environment examples, browser-extension variables, plaintext local data, tests,
screenshots, logs, issues, or commits. Values prefixed with `NEXT_PUBLIC_` or `VITE_`
are public by design and must never hold secrets.

The credential API never returns a secret after submission. It returns only connection
state and a one-way fingerprint. The Chrome extension receives a separate, random
device token stored in `chrome.storage.local`; it never receives provider credentials.
The dashboard stores only the token's SHA-256 hash in the owner-only local database.
Encrypted provider credentials and approved extension devices persist until explicitly
removed.

CRM connection objects that contain tenant URLs and OAuth access tokens follow the same
rule: plaintext exists only while a request is using it. Tenant URLs are accepted only
when they match the provider's documented HTTPS domain suffix.

If a secret reaches Git—even in an old commit—revoke it first. Rewriting history alone
does not make a credential safe again.

## Threat model and boundaries

- Anyone with access to the same OS account can read the local application's data.
- Personas, knowledge text, original knowledge uploads, research history, and role-play
  transcripts are stored under `data/` with owner-only permissions. They are not
  encrypted at rest; full-disk encryption and OS-account security remain the user's
  responsibility.
- A malicious browser extension or local process may be able to call loopback services.
- The dashboard credential endpoints reject `chrome-extension://` origins. Extension
  research endpoints require a valid bearer token bound to the requesting Chrome
  extension ID.
- Extension approval requests expire after five minutes, are capped, and require an
  explicit approval in Dashboard Settings. Raw device tokens are returned once to the
  exact requesting extension and are never stored by the dashboard.
- The encrypted credential file and its separate random device key are both protected
  by owner-only filesystem permissions and excluded from Git. This is not an OS
  keychain: anyone who compromises the same OS account can access both. Use full-disk
  encryption and do not use this design on a shared or compromised account.
- Website text is untrusted. Local analysis treats it as text; do not reintroduce
  `innerHTML`, shell execution, dynamic code execution, or model/tool instructions.
- AI synthesis is opt-in per request. It sends the bounded research prompt to exactly
  the provider selected by the user. Provider billing, retention, abuse monitoring,
  and account policies then apply. Do not submit confidential or regulated data.
- Live provider adapters use fixed HTTPS endpoints. Do not accept a provider base URL
  from a browser request or credential field.
- Review lookups are opt-in per request and use fixed Google Places or Outscraper
  endpoints. Results remain ephemeral. Raw review excerpts are not included in AI
  synthesis prompts. Provider billing, display, attribution, retention, and usage terms
  remain the user's responsibility.
- Dashboard website retrieval permits only public HTTP(S) pages on ports 80/443. It
  validates and pins public DNS answers for each redirect and enforces time, redirect,
  content-type, encoding, and response-size limits. Do not replace this helper with a
  raw `fetch(userUrl)`.
- The extension uses Chrome's temporary `activeTab` grant after a user gesture; it does
  not request persistent access to every website.

## Deployment warning

Public deployment is unsupported. Binding or proxying the application to a LAN or the
internet would expose unauthenticated local data and mutation operations. A hosted
version requires a separate security design: authentication, authorization, tenant
isolation, CSRF protection, persistent rate limits, safe storage, audit logging, and a
new privacy policy.

## Release checklist

1. Run `npm run release:check` and current dependency advisory checks for both package
   lockfiles.
2. Review the complete Git history with the pinned Gitleaks release used by CI.
3. Verify the release from a fresh clone. It must contain no `.env`, credential key,
   encrypted credential store, database, upload, persona, transcript, research record,
   extension build, or other user-generated file. `data/.gitkeep` is the only allowed
   path under `data/`.
4. Confirm the server still binds to loopback-only `localhost:5178`.
5. Confirm no provider is enabled without an explicit user connection, narrow
   permissions, a documented cost class, and outbound requests pinned to fixed hosts.
6. Review extension permissions and its generated manifest.
7. For a public repository, enable secret scanning, push protection, Dependabot
   alerts, and private vulnerability reporting.
