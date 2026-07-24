# Security audit

Date: 2026-07-23

Scope: tracked source, local ignored credential files, browser-extension manifest,
dependencies, Next.js routes/actions, local persistence, outbound network paths, and
reachable Git history in this clone.

## Executive result

The original project was not safe for public release or zero-cost operation. It put
OpenAI and Hunter credentials into browser-bundled `VITE_*` variables, exposed
unauthenticated billable routes, accepted attacker-controlled URLs in server fetches,
and depended on several metered services.

The hardened default is keyless and local-only. Paid provider SDKs and calls were
removed. Website retrieval was rebuilt with public-address validation, DNS pinning,
manual redirect validation, and strict response limits. Loopback binding and request
checks were added, request/upload limits were added, sensitive local data was
untracked, and security headers were enabled.

## Critical/high findings repaired

| Severity | Finding | Repair |
| --- | --- | --- |
| Critical | OpenAI and Hunter secrets were copied into `VITE_*` variables and therefore into extension bundles. | Removed both local credential files, the sync script, client SDK usage, and all provider variables. Credentials still require revocation. |
| Critical | Public callers could trigger OpenAI/Places usage without authentication or durable quotas. | Removed all billable calls and provider SDKs. Routes now use local deterministic behavior or return `410`. |
| Critical | `/api/scrape` and `/api/research` fetched arbitrary URLs, enabling SSRF and access to private/loopback services. | Replaced raw fetching with a dedicated retriever that allows public HTTP(S) on ports 80/443, rejects private/special DNS answers, pins the validated address, revalidates redirects, and bounds time/type/size. |
| High | `/api/context` exposed the full local knowledge base and personas to any caller. | Restricted API requests to loopback/extension origins and bound the server to `127.0.0.1`. |
| High | Error responses returned raw provider/internal messages. | Centralized generic public errors. |
| High | Unbounded JSON/chat inputs enabled memory, token-cost, and prompt-amplification abuse. | Added byte, count, and character limits. |
| High | Uploads accepted arbitrary types and lacked a hard byte limit. | Limited uploads to 5 MB PDF/text/Markdown files. |
| High | Tracked `data/db.json` could later capture private knowledge or transcripts. | Removed it from tracking; runtime data is ignored and owner-readable only. |
| High | Extension CSP explicitly allowed OpenAI, Hunter, and Supabase endpoints. | Removed those endpoints and tightened the extension CSP. |

## Medium/low findings repaired

- Removed technology disclosure via the Next.js powered-by header.
- Added CSP, anti-framing, MIME sniffing, referrer, permissions, resource policy, and
  no-store headers.
- Replaced non-atomic database writes with owner-only atomic writes.
- Expanded secret and credential ignore patterns.
- Removed Supabase schema/client remnants that implied a hosted/multi-user security
  model this application does not provide.
- Added explicit-run Apollo and Hunter adapters. Provider credentials remain in server
  memory, provider hosts are fixed in source, and ordinary website analysis never
  triggers these credit-consuming endpoints.

## Residual risks

1. Perfect security cannot be guaranteed. New dependencies, code changes, browser
   behavior, and supply-chain compromise can create future vulnerabilities.
2. Previously present credentials must be revoked in their provider dashboards.
   Deleting files does not revoke keys.
3. Loopback is a meaningful boundary, not authentication. Malicious local software or
   another extension may target the service.
4. Browser speech recognition may send audio/transcripts to a browser vendor depending
   on browser/platform behavior.
5. Chrome's temporary `activeTab` grant still exposes the selected page to the
   extension after the user activates it. Users should avoid activating it on sensitive
   internal pages.
6. Public websites may block automated clients, require JavaScript, or expose little
   useful server-rendered HTML. The tool reports that limitation instead of bypassing
   access controls.
7. The keyword-based local analyzer is less capable than hosted language models. That
   is the direct privacy/cost tradeoff.
8. Dependency advisory and maintained full-history secret scans must be rerun before
   every publication because vulnerability databases and scanner rules change.

## Credential incident response

The removed local files contained values for OpenAI, Google Places, Hunter, and
Supabase. Revoke or rotate every one of those values, even though this audit did not
find matching high-confidence token patterns in reachable commits. Check provider usage
logs and billing, remove stale hosted-project environment variables, and invalidate
Supabase sessions if that project held real data.

## Verification performed

- Root production build: passed.
- Extension TypeScript/Vite production build: passed.
- Root and extension ESLint: passed with warnings only.
- Working-tree prohibited-secret/provider scan: passed.
- Reachable Git-history high-confidence secret pattern scan: no matches found.
- Runtime smoke test: public HTML retrieval returned `200`; loopback and cloud-metadata
  scrape targets returned `422`; extension credential access returned `403`; an
  unpaired extension CRM request returned `401`; pairing creation/redemption returned
  `200`; CSP was present.
- Production dependency advisory lookup: dashboard and extension both reported zero
  known vulnerabilities after upgrading Next.js and applying patched PostCSS/Sharp
  overrides.
