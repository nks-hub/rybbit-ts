# @nks-hub/rybbit-ts

[![Build Status](https://github.com/nks-hub/rybbit-ts/actions/workflows/build.yml/badge.svg)](https://github.com/nks-hub/rybbit-ts/actions)
[![npm version](https://img.shields.io/npm/v/@nks-hub/rybbit-ts.svg)](https://www.npmjs.com/package/@nks-hub/rybbit-ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> TypeScript wrapper for [Rybbit Analytics](https://rybbit.io) with typed events, Google Tag Manager forwarding and an event queue.

## Features

- 🍪 **No cookies** - The SDK writes none, and Rybbit tracks without them
- 🔀 **Three loading strategies** - Injects the script tag, uses the @rybbit/js SDK, or detects which one the page already has
- 📥 **Event queue** - Buffers events sent before the SDK is ready and replays them after initialization
- 🏷️ **Typed events** - TypeScript types for GA4-compatible events (purchase, add_to_cart, view_item, etc.)
- 🏗️ **GTM bridge** - Forwards Google Tag Manager dataLayer events to Rybbit
- 👤 **User identification** - Reads the user ID from the server-rendered DOM
- 🧪 **Dry-run mode** - Logs events to the console instead of sending them
- 🎥 **Session replay** - Starts and stops session recording from code

## Requirements

- **Node.js**: 16+ recommended
- **TypeScript**: 5.0+ (for TypeScript projects)
- **Browsers**: ES6 support

## Installation

```bash
npm install @nks-hub/rybbit-ts
```

## Usage

### ES Module

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

### Script tag (IIFE)

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

## Configuration

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

## Bot detection and E2E testing

Since Rybbit `v2.5` the analytics script ships an automatic client-side bot
score (`_bs`). The server silently drops events it considers bot traffic,
including these patterns:

- `navigator.webdriver === true` (Selenium / Playwright / Puppeteer default)
- Headless Chrome (SwiftShader WebGL renderer, missing `window.chrome`, no plugins)
- `outerWidth/outerHeight === 0`, `connection.rtt === 0`
- Server-side: viewport `800×600` on a desktop User-Agent (Puppeteer default)

The SDK does not build payloads itself. The `script.js` served by Rybbit adds
`_bs`, so existing integrations stop recording automated traffic without a
code change.

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
`message: "bot detected"`, and no error shows up in the browser).

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting started](docs/getting-started.md) | Installation, configuration, and loading strategies |
| [Events reference](docs/events.md) | Catalog of typed events with examples |
| [GTM Bridge](docs/gtm-bridge.md) | Google Tag Manager integration guide |
| [API reference](docs/api.md) | SDK API documentation |
| [Examples](docs/examples.md) | Integration examples |

## Build outputs

| File | Format | Size | Use Case |
|------|--------|------|----------|
| `dist/index.esm.js` | ESM | ~24 KB | Bundlers (Vite, webpack, Rollup) |
| `dist/index.js` | CJS | ~25 KB | Node.js / require() imports |
| `dist/index.iife.js` | IIFE | ~26 KB | Direct script tag (development) |
| `dist/index.iife.min.js` | IIFE | ~13 KB | Direct script tag (production) |
| `dist/index.d.ts` | Types | ~10 KB | TypeScript definitions |

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
