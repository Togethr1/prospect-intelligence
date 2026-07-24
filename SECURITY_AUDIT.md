# Security audit

Audit date: 2026-07-24

Release target: local-only, single-user dashboard and Manifest V3 Chrome extension

Repository: `Togethr1/prospect-intelligence`

## Executive result

The audited tree is suitable for a public **source-code** release after every mandatory
release gate in this document passes. The application is intentionally not a hosted
service. It binds to the local loopback interface, stores user data on the user's
device, and calls optional third-party providers only with credentials supplied by
that user.

This audit removed legacy code, closed unpaired extension access to research and AI
routes, narrowed trusted dashboard origins, strengthened server-side request forgery
defenses, bounded untrusted inputs and provider responses, validated stored persona
and knowledge records, and added repeatable security regression tests and CI gates.

No security review can prove that future defects or supply-chain compromises are
impossible. The release claim is therefore deliberately narrow: the checks below found
no committed credential or user-generated data, and the current controls materially
reduce the identified risks within the documented local-only threat model.

## Scope

The review covered:

- the complete reachable Git history and current release-candidate files;
- Next.js route handlers, server actions, request boundaries, and security headers;
- local database, uploads, transcripts, research records, encrypted credentials, and
  extension pairing;
- public website retrieval and every server-side outbound provider request;
- AI prompt construction, provider selection, response parsing, URL handling, and
  request frequency;
- Chrome extension permissions, content security policy, page analysis, pairing, and
  dashboard communication;
- LiveKit and AssemblyAI session-token issuance;
- persona and knowledge creation, editing, deletion, and persistence;
- dependency manifests, lockfiles, CI workflow, lint, tests, and production builds.

Out of scope:

- third-party provider infrastructure, retention, billing, and model behavior;
- the security of Chrome, the operating system, DNS resolver, network, or GitHub;
- malicious software already running as the same OS user;
- public hosting, multi-user use, or use on a shared/untrusted computer;
- provider credentials that may have been copied outside this repository.

## Methodology

The review combined:

1. manual source review of trust boundaries, data flows, and provider adapters;
2. exact Git path inspection for tracked and ignored runtime data;
3. a full-history scan with the official Gitleaks 8.30.1 binary and redacted output;
4. a repository scanner that checks tracked and non-ignored release candidates without
   printing matched secret values;
5. security regression tests for origin enforcement, dashboard/extension separation,
   private and special-purpose IP blocking, public URL normalization, bounded text
   handling, and LiveKit Cloud URL restrictions;
6. root and extension lint and production builds;
7. a clean-clone blank-slate inspection before publication.

The clean-clone check is mandatory because ignored local files can safely remain on a
developer's computer while being absent from the public artifact.

## Data-flow and trust boundaries

### Dashboard

The dashboard is accepted only on these exact origins:

- `http://localhost:5178`
- `http://127.0.0.1:5178`
- `http://[::1]:5178`

The Host header must also resolve to one of the same loopback hosts on port 5178.
Dashboard-only credential and mutation routes explicitly reject
`chrome-extension://` callers. The development and production scripts bind Next.js to
`localhost:5178`.

This is a local boundary, not user authentication. A process already running as the
same user can still target loopback or read local files.

### Chrome extension

The extension uses Manifest V3 and requests only:

- `sidePanel`;
- temporary `activeTab`;
- `scripting`;
- local extension `storage`;
- host access to `http://localhost:5178/*`.

It does not request persistent access to all websites. Page analysis begins after a
user gesture and is restricted to public HTTP(S) origins. Internal, loopback,
single-label, special-purpose, credential-bearing, custom-port, and literal-IPv6 URLs
are rejected.

The extension must be paired before it can read local context or invoke research,
assistant, CRM, review, transcription, or synthesis routes. The bearer token is stored
in `chrome.storage.local`; the dashboard stores only its SHA-256 hash. Provider
credentials are never returned to the extension.

### Local persistence

Runtime state lives under ignored paths in `data/`:

- application database;
- encrypted provider credential store;
- device-only credential encryption key;
- uploaded knowledge documents.

Database and credential writes use owner-only permissions and atomic replacement.
Provider secrets are encrypted with AES-256-GCM. The encryption key and ciphertext are
separate files, but both are readable by the same OS account; this protects against
accidental disclosure and repository leakage, not compromise of that account.

Personas, knowledge text, uploads, research history, and transcripts are not encrypted
at rest. Users should rely on full-disk encryption and a trusted OS account.

## Findings repaired

### Critical and high

| Severity | Finding | Repair |
| --- | --- | --- |
| Critical | Several extension-accessible research and AI routes accepted a Chrome extension origin without first proving that the extension had been paired. | Added pairing enforcement to research, scrape, chat, research-chat, and related provider routes. Extension requests now attach the pairing token consistently. |
| High | Dashboard origin validation trusted any `localhost` port. | Replaced suffix/host trust with an exact allowlist for the three loopback origins on port 5178. |
| High | The public web retriever's handwritten address checks did not comprehensively cover IPv4-mapped IPv6 and special-purpose ranges. | Replaced them with `net.BlockList` coverage, explicit mapped-address rejection, DNS validation and pinning, redirect revalidation, and tests. |
| High | Provider handlers could buffer an arbitrarily large successful HTTP response before truncating it. | Added streaming reads, declared-length checks, a 1 MB hard cap, cancellation, timeouts, and strict object-shaped JSON parsing. |
| High | Persona and knowledge mutations accepted weakly bounded or structurally unchecked data. | Added shared Zod schemas, UUID checks, field/array limits, database collection limits, upload type/size/magic checks, extraction limits, and cleanup on failed writes. |
| High | A user-supplied LiveKit URL could direct server credentials or requests to an arbitrary host. | Restricted projects to HTTPS/WSS subdomains of `livekit.cloud` with no credentials, custom port, path, query, or fragment. |

### Medium

| Severity | Finding | Repair |
| --- | --- | --- |
| Medium | Website, CRM, and knowledge text could contain prompt-injection instructions. | AI system prompts now label all retrieved material as untrusted data and forbid following embedded instructions or revealing credentials and hidden prompts. |
| Medium | Provider-supplied URLs could be rendered without protocol validation. | Added centralized HTTP(S)-only URL normalization before storing or returning citations, review links, social links, and CRM URLs. |
| Medium | Several metered endpoints lacked a server-side request-frequency bound. | Added in-process limits for LiveKit session creation, AI assistant calls, intelligence, review, and CRM lookups. Existing synthesis and transcription limits remain. |
| Medium | Uploaded PDF handling used an incompatible parser API and lacked robust page/text bounds. | Migrated to the current parser API, capped parsed pages and extracted text, validated PDF magic bytes, and removed partial files on failure. |
| Medium | Local database writes used predictable temporary names and lacked top-level size/count limits. | Added random exclusive temporary files, atomic rename, a 50 MB database cap, and limits for personas, knowledge items, transcripts, vectors, and research records. |
| Medium | CI depended on floating marketplace action tags and scanned only source patterns. | Pinned checkout/setup actions by commit SHA, downloaded a pinned Gitleaks release, verified its checksum, scanned full history with redacted output, and runs regression tests. |

### Low and quality

- Removed obsolete duplicate dashboard components, unused extension contexts/views,
  abandoned rewrite scripts, template assets, and direct dependencies no longer used.
- Aligned package identities and versions with the public project and extension.
- Removed fake optimistic records and now render the persisted record returned by the
  database.
- Replaced several `any` values and hidden mutation errors with typed, bounded public
  errors.
- Preserved a nonce-based dashboard content security policy and a restrictive
  extension content security policy.
- Kept provider endpoints fixed in source except for documented tenant hosts that are
  validated against provider-specific HTTPS suffixes.

## Blank-slate publication gate

The GitHub release must start empty. Source documentation such as `README.md`,
`SECURITY.md`, and this audit is intentionally included; **user-created documents and
runtime records are not**.

The following must be absent from the clean clone:

- API keys, OAuth tokens, passwords, client secrets, service-account files, or private
  keys;
- `.env` files other than a deliberately reviewed non-secret example;
- encrypted credential files and their device encryption key;
- application database JSON;
- knowledge uploads or extracted user documents;
- personas, transcripts, research records, CRM results, and review results;
- extension `dist`, Next.js `.next`, `node_modules`, logs, and OS metadata.

`data/.gitkeep` is the only permitted path under `data/`. On first use the application
creates a new empty local database and new device encryption key on that user's
computer.

The release scanner obtains its file list from:

```text
git ls-files --cached --others --exclude-standard
```

That makes an accidentally unignored local file fail the gate even before it is staged.
The scan reports only the finding category and file/line, never a suspected secret
value.

## Cost and privacy controls

- Keyless local analysis does not require an API key.
- Every provider connector is user-supplied and disabled until connected.
- Credit- or usage-consuming providers run only after an explicit action.
- Provider credentials remain server-side and are never included in research results.
- AI prompts and provider responses are bounded.
- Raw review excerpts are excluded from AI synthesis prompts.
- Transcription and voice role play show that provider usage may be metered.
- Browser Speech may use Chrome's speech service even though it needs no separate API
  credential.

“Free tool” means this repository does not impose a subscription or bundled API bill.
Optional third-party accounts can still charge the user according to their own plans.

## Residual risks and required operator controls

1. **Same-user compromise:** a process running as the same OS user can read the
   database, uploads, encryption key, and encrypted credentials. Use a trusted account
   and full-disk encryption.
2. **Loopback is not authentication:** malicious local software can target the server.
   Do not bind or proxy it to a LAN or public interface.
3. **In-memory rate limits reset:** they reduce accidental/repeated local usage but are
   not a durable abuse-control system and are unsuitable for hosted deployment.
4. **Extension page access:** `activeTab` lets the extension read the page the user
   explicitly activates. Do not activate it on confidential internal pages.
5. **Browser-side DNS:** the extension blocks known internal URL forms but cannot pin
   browser DNS the way the server retriever does. Server-side outbound retrieval uses
   the stronger DNS-pinned path.
6. **Prompt injection:** instructions and tool access are constrained, but model output
   is not guaranteed to be correct. Do not treat generated sales guidance as factual
   without review.
7. **Third parties:** connected providers receive the minimum request data needed for
   the selected operation and may retain, monitor, or bill it under their policies.
8. **Provider API drift:** endpoints, models, permissions, and pricing can change.
   Revalidate connectors before each release.
9. **Supply chain:** lockfiles and pinned CI actions reduce drift but cannot eliminate
   a compromised registry package, action commit, browser, or runtime.
10. **Future changes:** every code or dependency change can invalidate this audit.
    Rerun the full gate before every publication.

## Verification record

Completed in this audit:

- official Gitleaks 8.30.1 full-history scan with redacted findings: **passed, zero
  findings**;
- structural inspection of historical `data/db.json`: **empty collections, no user
  records**;
- tracked and release-candidate path/secret scan: **passed**;
- security regression tests: **passed**;
- root ESLint: **passed**;
- extension ESLint: **passed**;
- root Next.js production build: **passed**;
- extension TypeScript/Vite production build: **passed**;
- npm advisory audit for the dashboard lockfile: **passed, zero vulnerabilities**;
- npm advisory audit for the extension lockfile: **passed, zero vulnerabilities**;
- disposable clean-clone source scan: **passed**;
- clean-clone data inspection: **only `data/.gitkeep`; no credential, environment,
  database, upload, persona, transcript, research, or generated-build files**;
- runtime header check: **nonce-based CSP, anti-framing, MIME-sniffing, referrer, and
  permissions headers present**;
- runtime boundary checks: **foreign Host rejected 403; foreign Origin rejected 403;
  extension access to dashboard settings rejected 403; unpaired extension context
  rejected 401**;
- runtime SSRF checks: **loopback, cloud-metadata, and custom-port targets rejected
  422**.

GitHub posture observed on 2026-07-24:

- the repository remains **private** while the release is being prepared;
- GitHub Actions is enabled, and the five most recent CI runs visible during the audit
  completed successfully;
- Dependabot vulnerability alerts are enabled;
- secret-scanning, code-scanning alert access, private vulnerability reporting, and
  branch protection were unavailable on the current private/free repository. Recheck
  and enable the applicable free protections immediately after making the repository
  public.

The clean-clone gate must still be rerun immediately before publication. A failed or
unavailable mandatory check must never be described as passing.

## Incident response

If a credential or user record ever reaches GitHub:

1. revoke or rotate the credential first;
2. remove the file from the current tree;
3. inspect the complete history and all forks, tags, pull requests, Actions artifacts,
   caches, releases, and clones;
4. rewrite history only after rotation, then force-update every affected ref;
5. ask collaborators to re-clone instead of merging old history;
6. review provider logs and billing;
7. notify affected users when user data was exposed;
8. document the incident and add a regression gate.

Deleting a file or rewriting Git history does not make a previously exposed credential
safe again.
