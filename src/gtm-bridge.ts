import { RybbitNativeAPI, EventProperties, NksRybbitConfig } from "./types";
import { log } from "./logger";

type DataLayerEntry = Record<string, unknown>;

let originalPush: ((...args: DataLayerEntry[]) => number) | null = null;

/**
 * Setup GTM dataLayer bridge.
 * Intercepts dataLayer.push() to forward matching events to Rybbit.
 */
export function setupGtmBridge(
  rybbit: RybbitNativeAPI,
  config: NksRybbitConfig
): void {
  if (typeof window === "undefined") return;

  const win = window as unknown as Record<string, unknown>;
  if (!Array.isArray(win.dataLayer)) {
    win.dataLayer = [];
  }

  const dataLayer = win.dataLayer as DataLayerEntry[];
  const allowedEvents = config.gtmEvents ?? [];

  // Process any existing events in dataLayer
  for (const entry of dataLayer) {
    processDataLayerEvent(entry, rybbit, allowedEvents);
  }

  // Intercept future pushes
  originalPush = dataLayer.push.bind(dataLayer);
  dataLayer.push = function (...args: DataLayerEntry[]) {
    const result = originalPush!(...args);
    for (const arg of args) {
      processDataLayerEvent(arg, rybbit, allowedEvents);
    }
    return result;
  };

  log("GTM dataLayer bridge active", { allowedEvents });
}

function processDataLayerEvent(
  entry: DataLayerEntry,
  rybbit: RybbitNativeAPI,
  allowedEvents: string[]
): void {
  if (!entry || typeof entry !== "object") return;

  const eventName = entry.event as string | undefined;
  if (!eventName || typeof eventName !== "string") return;

  // Skip GTM internal events
  if (
    eventName.startsWith("gtm.") ||
    eventName === "gtag.config" ||
    eventName === "optimize.activate"
  ) {
    return;
  }

  // If allowedEvents specified, filter
  if (allowedEvents.length > 0 && !allowedEvents.includes(eventName)) {
    return;
  }

  // Extract properties (everything except 'event' and GTM internals)
  const properties: EventProperties = {};
  for (const [key, value] of Object.entries(entry)) {
    if (
      key === "event" ||
      key.startsWith("gtm.") ||
      key === "gtag.config" ||
      key === "eventCallback" ||
      key === "eventTimeout"
    ) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      properties[key] = value;
    }
  }

  log(`GTM bridge forwarding: ${eventName}`, properties);
  rybbit.event(eventName, Object.keys(properties).length > 0 ? properties : undefined);
}

export function teardownGtmBridge(): void {
  if (
    typeof window !== "undefined" &&
    originalPush &&
    Array.isArray((window as unknown as Record<string, unknown>).dataLayer)
  ) {
    const dataLayer = (window as unknown as Record<string, unknown>)
      .dataLayer as DataLayerEntry[];
    dataLayer.push = originalPush;
    originalPush = null;
  }

  log("GTM bridge teardown");
}
