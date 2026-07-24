# Contributing

Thanks for helping improve Open Prospect Intelligence.

## Ground rules

- Never submit credentials, tokens, private prospect data, call recordings, or customer
  exports.
- Use only documented provider APIs or user-authorized imports. Do not add automated
  scraping of logged-in third-party product interfaces.
- Free local behavior must remain the default.
- A metered or credit-consuming provider must require an explicit connection and a
  separate, clearly labeled user action.
- Outbound provider requests must use fixed, reviewed hosts. User-controlled base URLs
  are not accepted.

## Development

```bash
npm ci
npm run dev
```

For the extension:

```bash
cd extension
npm ci
npm run build
```

## Pull-request gate

```bash
npm run security:check
npm run lint
npm run build
npm --prefix extension run lint
npm --prefix extension run build
```

Describe any provider cost, scopes, data retention, rate limits, and test strategy in
the pull request.
