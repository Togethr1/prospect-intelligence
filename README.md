# Local Sales Intelligence Assistant

An open-source, bring-your-own-tools sales research and call-practice workspace. The
free default mode uses deterministic local analysis, the browser's built-in speech
APIs, and a JSON file on your computer. Optional integrations are explicitly
user-supplied and disabled until connected.

Live connectors include HubSpot CRM plus explicit-run Apollo organization enrichment
and Hunter domain search. Results are available in both the dashboard and paired Chrome
extension. The Settings page also publishes the planned connector matrix without
pretending unfinished adapters exist.

## Security and cost model

- No API key is bundled, committed, or required for the free local features.
- Optional HubSpot credentials are held in server memory for the current process only.
  They are never returned to the browser, written to disk, or sent to the extension.
- The extension receives a revocable, process-lifetime pairing token—not provider
  credentials.
- The dashboard binds to `127.0.0.1`, not the public network.
- Billable providers are disabled unless a future adapter clearly labels its cost class
  and requires an explicit user connection.
- Website retrieval accepts only public HTTP(S) pages on standard ports. DNS results
  are validated and pinned, private/local ranges are blocked on every redirect, and
  response size, type, redirects, and duration are bounded.
- User data stays in `data/db.json`, which is ignored by Git and created with owner-only
  file permissions.
- The extension reads a page only after the user activates it and analyzes page text
  locally.
- The extension uses the temporary `activeTab` grant to inspect the user-selected page
  and can contact only the local dashboard.

This is a risk-reduced local tool, not a claim of perfect security. Read
[SECURITY.md](SECURITY.md) before publishing or changing the network model.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Do not override the host binding to `0.0.0.0`.

## Optional HubSpot connection

1. Open **Settings → CRM → HubSpot**.
2. Supply your own HubSpot private-app token with only the read scopes required for
   companies, contacts, and deals.
3. The token remains in memory until the dashboard process exits or you disconnect it.
4. Enter a prospect website in Intelligence. The dashboard retrieves public readable
   HTML automatically; CRM matching uses the normalized hostname and an exact domain
   search.

HubSpot usage and account eligibility are governed by HubSpot. This project does not
sell, proxy, or subsidize provider access, and cannot guarantee that a third-party
provider will remain free.

## Build the extension

```bash
cd extension
npm ci
npm run build
```

Load `extension/dist` as an unpacked extension. Start the dashboard before using
features that read the local knowledge base or CRM. In dashboard Settings, generate a
short-lived pairing code and enter it in the extension's Settings tab. Pairing tokens
expire when the dashboard restarts.

## Connector status

- **Live:** HubSpot CRM, Apollo organization enrichment, Hunter domain search,
  automatic public-page retrieval, local page analysis, and the local knowledge base.
- **Planned/disabled:** Salesforce, Pipedrive, Close, Zoho CRM, Dynamics 365, Attio;
  ZoomInfo, Seamless, Lusha, Snov.io, Clearbit, RocketReach, LinkedIn
  Sales Navigator, LeadIQ, Clay, 6sense, Bombora, Demandbase, and G2; Claude, Gemini,
  OpenAI, Perplexity, and Grok.

“Planned” means there is no network adapter and no credential input for that provider.
Contributors should not mark a provider live until its permissions, cost behavior,
error handling, data retention, and tests meet the release gates.

## Data deletion

Stop the dashboard and delete `data/db.json`. That file is local and untracked.

## Public release gate

Before every release:

```bash
npm run security:check
npm run lint
npm run build
cd extension && npm run lint && npm run build
```

Also enable GitHub secret scanning, push protection, Dependabot alerts, and branch
protection in the public repository.
