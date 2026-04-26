# Changelog

## 0.1.1 — 2026-04-26

### Compatibility

- Documented behaviour against Rybbit `v2.5` server-side bot detection
  (`_bs` client signal score, headless Chrome heuristics, `800×600` viewport
  filter). The SDK itself needs no code change — the `script.js` served by
  the Rybbit instance computes and submits `_bs` automatically.

### Docs

- New README section **Bot Detection & E2E Testing** explaining when
  Playwright/Puppeteer runs get silently dropped and how `dryRun: true`
  bypasses both the script load and the server filter.

## 0.1.0

- Initial release.
