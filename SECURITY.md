# Security policy

## Supported use

This project is designed for one person running it on their own computer. The Next.js
server must remain bound to `127.0.0.1`. It is not designed for public hosting,
multi-user use, untrusted shared computers, or storage of regulated/confidential data.

## Reporting a vulnerability

Do not open a public issue containing exploit details or private data. Use GitHub's
private vulnerability reporting feature for the repository. Maintainers should revoke
any exposed credential before investigating how it leaked.

## Credential rule

The free local features do not need API keys. Optional provider credentials must be
supplied by the user through Settings. The current HubSpot adapter keeps its token only
in server memory for the life of the process. Credentials must never be placed in
source, environment examples, browser-extension variables, persistent local data,
tests, screenshots, logs, issues, or commits. Values prefixed with `NEXT_PUBLIC_` or
`VITE_` are public by design and must never hold secrets.

The credential API never returns a secret after submission. It returns only connection
state and a one-way fingerprint. The Chrome extension receives a separate, random
pairing token stored in `chrome.storage.local`; it never receives provider credentials.
Restarting the dashboard invalidates both provider sessions and extension pairings.

If a secret reaches Git—even in an old commit—revoke it first. Rewriting history alone
does not make a credential safe again.

## Threat model and boundaries

- Anyone with access to the same OS account can read the local application's data.
- A malicious browser extension or local process may be able to call loopback services.
- The dashboard credential endpoints reject `chrome-extension://` origins. The CRM
  lookup endpoint requires a valid pairing bearer token for extension-origin requests.
- Process-memory storage reduces persistence risk but is not an OS keychain. Do not use
  this design on a shared or compromised OS account.
- Browser speech recognition implementations may use browser-vendor services. Do not
  use the microphone feature for sensitive calls unless you have verified your
  browser's data handling.
- Website text is untrusted. Local analysis treats it as text; do not reintroduce
  `innerHTML`, shell execution, dynamic code execution, or model/tool instructions.
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

1. Run the repository security check, lint, builds, and dependency audits.
2. Review the complete Git history with a maintained secret scanner.
3. Confirm no `.env`, database, extension build, transcript, or user-data file is staged.
4. Confirm the server still binds to `127.0.0.1`.
5. Confirm no provider is enabled without an explicit user connection, narrow
   permissions, a documented cost class, and outbound requests pinned to fixed hosts.
6. Review extension permissions and its generated manifest.
7. Enable secret scanning, push protection, Dependabot, and private vulnerability reports.
