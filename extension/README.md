# Prospect Intelligence Chrome extension

The extension runs in Chrome's side panel and connects only to the local dashboard at
`http://localhost:5178`.

## Included workflows

- **Live Coach** — unlocks after an AI provider is connected, transcribes a microphone
  session, and returns AI guidance grounded in saved research, CRM results, knowledge,
  talk tracks, ICP notes, personas, and local objection matches.
- **Assistant** — uses an explicitly selected connected AI provider to answer questions
  with the same local context.
- **Research** — reads the active public website after the user presses Analyze, runs
  the free local analyzer, and can display explicit-run CRM, sales-intelligence, review,
  and AI-provider results.
- **Customize View** — toggles and reorders website research fields, adds custom
  extraction signals, and controls whether connected-tool outputs are displayed.

## Cost and privacy boundaries

- Live Coach and Assistant remain locked until the user connects an AI provider in
  Dashboard Settings. The default Browser Speech transport requires no additional
  transcription key, but Chrome may use its speech service, so it is not an offline
  privacy guarantee.
- Local objection matching makes no provider request.
- AssemblyAI streaming is optional and metered. The dashboard exchanges the locally
  encrypted AssemblyAI key for a short-lived, single-use token; the permanent key never
  enters the extension. Always end a session when finished because streaming is billed
  while its WebSocket remains open.
- AI coaching is optional. Starting a session is the explicit action that authorizes
  requests to the selected provider, and requests are limited to at most one every ten
  seconds. Provider charges, quotas, retention, and terms apply.
- Provider credentials remain in the dashboard's encrypted local store. The extension
  receives research results and a revocable device token, never provider keys.
- Research and provider actions do not run in the background.

The microphone path can hear the device microphone. It cannot silently capture a
native phone call, operating-system audio, or another application. For browser dialers,
use a microphone/speaker setup or add an explicit Chrome tab-capture workflow with the
additional permission and user disclosure required by Chrome.

## Build and load

```bash
npm ci
npm run lint
npm run build
```

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select `extension/dist`.
4. Start the dashboard at `http://localhost:5178`.
5. Open the extension's link icon, request access, and approve the request in Dashboard
   **Settings → Chrome extension access**.
6. Pin **Prospect Intelligence** in Chrome once. Clicking its top-right toolbar icon now
   opens the right-side panel directly; the extension does not inject a launcher or
   request blanket access to every webpage.

The approval is bound to that Chrome extension ID, stored as a one-way token hash by the
dashboard, and can be revoked at any time.
