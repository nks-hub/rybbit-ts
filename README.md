# @nks-hub/rybbit-ts

[![Build Status](https://github.com/nks-hub/rybbit-ts/actions/workflows/build.yml/badge.svg)](https://github.com/nks-hub/rybbit-ts/actions)
[![npm version](https://img.shields.io/npm/v/@nks-hub/rybbit-ts.svg)](https://www.npmjs.com/package/@nks-hub/rybbit-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Privacy-first analytics SDK for TypeScript - A modern wrapper for [Rybbit Analytics](https://rybbit.io) with typed events, GTM integration, and zero-configuration setup.

---

## Why Rybbit?

**Privacy-first. Cookieless. No consent popups needed.**

Rybbit Analytics provides GDPR-compliant, cookieless tracking without requiring user consent dialogs. This SDK makes integration effortless with:

- **Zero cookies** - No consent banners required
- **TypeScript-first** - Fully typed GA4-compatible events
- **GTM-ready** - Seamless Google Tag Manager bridge
- **Queue management** - Never lose events during initialization
- **Multiple loading strategies** - Works with any setup

---

## Quick Start

### Installation

```bash
npm install @nks-hub/rybbit-ts
```

### Usage

#### ES Module

```typescript
import nksRybbit from '@nks-hub/rybbit-ts';

// Initialize SDK
await nksRybbit.boot({
  host: 'https://demo.rybbit.com',
  siteId: 'your-site-id'
});

// Track events
nksRybbit.event('click_cta', { button: 'hero' });

// E-commerce tracking
nksRybbit.trackPurchase({
  transactionId: 'TX-001',
  value: 1299,
  currency: 'CZK'
});
```

#### Script Tag (IIFE)

```html
<script src="https://cdn.example.com/nks-rybbit.iife.min.js"></script>
<script>
  NksRybbit.default.boot({
    host: 'https://demo.rybbit.com',
    siteId: 'your-site-id'
  });

  NksRybbit.default.event('page_view');
</script>
```

---

## Features

| Feature | Description |
|---------|-------------|
| **3 Loading Strategies** | Script injection, @rybbit/js SDK integration, or auto-detect |
| **Event Queuing** | Buffers events before SDK ready, replays on initialization |
| **Typed Events** | Full TypeScript support for GA4-compatible events (purchase, add_to_cart, view_item, etc.) |
| **GTM Bridge** | Auto-forward Google Tag Manager dataLayer events to Rybbit |
| **User Identification** | Automatic user ID extraction from server-rendered DOM |
| **Dry-run Mode** | Test integration by logging events without sending |
| **Session Replay** | Programmatic control over session recording |

---

## Bot Detection & E2E Testing

Since Rybbit `v2.5` the analytics script ships an automatic client-side bot
score (`_bs`). The server silently drops events when it considers the request
a bot — including all of these patterns:

- `navigator.webdriver === true` (Selenium / Playwright / Puppeteer default)
- Headless Chrome (SwiftShader WebGL renderer, missing `window.chrome`, no plugins)
- `outerWidth/outerHeight === 0`, `connection.rtt === 0`
- Server-side: viewport `800×600` on a desktop User-Agent (Puppeteer default)

The SDK does not build payloads itself — the server-served `script.js` adds
`_bs` automatically — so existing integrations stop seeing automated traffic
without any code change.

**For your own E2E tests**, set `dryRun: true` so the SDK never loads
`script.js` and instead logs every call locally:

```typescript
await nksRybbit.boot({
  host: 'https://demo.rybbit.com',
  siteId: 'your-site-id',
  dryRun: process.env.NODE_ENV === 'test',
});
```

Without `dryRun`, your Playwright/Puppeteer test runs will be flagged as bots
and silently dropped (the request still returns `200 OK` but with
`message: "bot detected"` — no error surfaces in the browser).

---

## Documentation

Comprehensive guides to get you up and running:

| Guide | Description |
|-------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, configuration, and loading strategies |
| [Events Reference](docs/events.md) | Complete catalog of typed events with examples |
| [GTM Bridge](docs/gtm-bridge.md) | Google Tag Manager integration guide |
| [API Reference](docs/api.md) | Full SDK API documentation |
| [Examples](docs/examples.md) | Real-world integration examples |

---

## Build Outputs

| File | Format | Size | Use Case |
|------|--------|------|----------|
| `dist/index.esm.js` | ESM | ~24 KB | Modern bundlers (Vite, webpack, Rollup) |
| `dist/index.js` | CJS | ~25 KB | Node.js / require() imports |
| `dist/index.iife.js` | IIFE | ~26 KB | Direct script tag (development) |
| `dist/index.iife.min.js` | IIFE | ~13 KB | Direct script tag (production) |
| `dist/index.d.ts` | Types | ~10 KB | TypeScript definitions |

---

## Configuration Example

```typescript
import nksRybbit from '@nks-hub/rybbit-ts';

await nksRybbit.boot({
  // Required
  host: 'https://demo.rybbit.com',
  siteId: 'your-site-id',

  // Optional
  loadStrategy: 'detect',             // 'detect' | 'script' | 'sdk'
  debug: false,                       // Console logging
  dryRun: false,                      // Test mode (log only)
  gtmBridge: true,                    // Forward GTM events
  gtmEvents: ['purchase'],            // Whitelist GTM events
  autoIdentify: true,                 // Auto-detect user from DOM
  globalProperties: { site: 'my-site' }
});
```

---

## Development

```bash
# Install dependencies
npm install

# Build SDK
npm run build

# Type checking
npm run typecheck

# Run tests
npm test

# Watch mode
npm run dev
```

---

## Requirements

- **Node.js**: 16+ recommended
- **TypeScript**: 5.0+ (for TypeScript projects)
- **Browsers**: Modern browsers with ES6 support

---

## Contributing

Contributions are welcome! For major changes, please open an issue first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: description'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- 📧 **Email:** dev@nks-hub.cz
- 🐛 **Bug reports:** [GitHub Issues](https://github.com/nks-hub/rybbit-ts/issues)
- 🐸 **Rybbit Analytics:** [rybbit.io](https://rybbit.io)

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/nks-hub">NKS Hub</a>
</p>
