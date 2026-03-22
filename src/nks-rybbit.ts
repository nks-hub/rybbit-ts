import {
  NksRybbitConfig,
  RybbitNativeAPI,
  EventProperties,
  EcommerceItem,
  EventCallback,
  ReadyCallback,
  QueuedEvent,
} from "./types";
import { log, warn, error as logErr, setDebug, setDryRun, isDryRun } from "./logger";
import { loadRybbit } from "./loader";
import { enqueue, flush, clearQueue } from "./queue";
import { setupGtmBridge, teardownGtmBridge } from "./gtm-bridge";
import { setupAutoTrack, teardownAutoTrack } from "./auto-track";

type BootState = "idle" | "booting" | "ready" | "failed";

let instance: NksRybbitSDK | null = null;

export class NksRybbitSDK {
  private config: NksRybbitConfig | null = null;
  private rybbit: RybbitNativeAPI | null = null;
  private state: BootState = "idle";
  private readyCallbacks: ReadyCallback[] = [];
  private eventListeners: EventCallback[] = [];
  private globalProps: Record<string, string | number | boolean> = {};

  /**
   * Initialize and boot the SDK.
   * Safe to call before DOM ready - events are queued until Rybbit loads.
   */
  async boot(config: NksRybbitConfig): Promise<void> {
    if (this.state === "ready" || this.state === "booting") {
      warn("SDK already initialized");
      return;
    }

    this.config = config;
    this.state = "booting";

    setDebug(config.debug ?? false);
    setDryRun(config.dryRun ?? false);

    if (config.globalProperties) {
      this.globalProps = { ...config.globalProperties };
    }

    try {
      if (isDryRun()) {
        log("Dry-run mode: no actual tracking");
        this.rybbit = this.createDryRunProxy();
      } else {
        this.rybbit = await loadRybbit(config);
      }

      this.state = "ready";
      log("SDK ready");

      // Auto-identify from DOM
      if (config.autoIdentify !== false) {
        this.autoIdentifyFromDom();
      }

      // Setup GTM bridge
      if (config.gtmBridge) {
        setupGtmBridge(this.rybbit, config);
      }

      // Setup auto-track
      if (config.autoTrack) {
        setupAutoTrack(this);
      }

      // Flush queued events
      this.flushQueue();

      // Notify ready callbacks
      for (const cb of this.readyCallbacks) {
        try {
          cb();
        } catch (e) {
          warn("Error in ready callback:", e);
        }
      }
      this.readyCallbacks = [];
    } catch (e) {
      this.state = "failed";
      logErr("Boot failed:", e);
    }
  }

  // ===========================================================================
  // CORE TRACKING
  // ===========================================================================

  /** Track a custom event */
  event(name: string, properties?: EventProperties): void {
    if (!name) {
      warn("Event name is required");
      return;
    }

    const merged = this.mergeProperties(properties);
    this.notifyListeners(name, merged);

    if (!this.isReady()) {
      enqueue("event", [name, merged]);
      return;
    }

    this.rybbit!.event(name, merged);
    log(`Event: ${name}`, merged);
  }

  /** Track a pageview */
  pageview(path?: string): void {
    if (!this.isReady()) {
      enqueue("pageview", [path]);
      return;
    }
    this.rybbit!.pageview(path);
    log("Pageview:", path ?? window.location.pathname);
  }

  /** Track an outbound link click */
  trackOutbound(url: string, text?: string, target?: string): void {
    if (!this.isReady()) {
      enqueue("trackOutbound", [url, text, target]);
      return;
    }
    this.rybbit!.trackOutbound(url, text, target);
    log("Outbound:", url);
  }

  /** Track a JS error */
  trackError(err: Error | ErrorEvent, context?: EventProperties): void {
    if (!this.isReady()) {
      enqueue("trackError", [err, context]);
      return;
    }
    if (this.rybbit!.error) {
      this.rybbit!.error(err, context);
    } else {
      // Fallback: send as custom event
      const message =
        err instanceof Error ? err.message : (err as ErrorEvent).message;
      this.rybbit!.event("error", {
        message: message ?? "Unknown error",
        ...(context ?? {}),
      });
    }
  }

  // ===========================================================================
  // TYPED GA4-COMPATIBLE EVENTS
  // ===========================================================================

  trackLogin(method?: string): void {
    this.event("login", method ? { method } : undefined);
  }

  trackSignUp(method?: string): void {
    this.event("sign_up", method ? { method } : undefined);
  }

  trackLogout(): void {
    this.event("logout");
  }

  trackPurchase(data: {
    transactionId: string;
    value: number;
    currency?: string;
    items?: EcommerceItem[];
  }): void {
    const props: EventProperties = {
      transaction_id: data.transactionId,
      value: data.value,
    };
    if (data.currency) props.currency = data.currency;
    if (data.items) {
      props.items = JSON.stringify(data.items);
    }
    this.event("purchase", props);
  }

  trackAddToCart(item: {
    itemId: string;
    itemName: string;
    price?: number;
    quantity?: number;
  }): void {
    this.event("add_to_cart", {
      item_id: item.itemId,
      item_name: item.itemName,
      ...(item.price !== undefined && { price: item.price }),
      ...(item.quantity !== undefined && { quantity: item.quantity }),
    });
  }

  trackRemoveFromCart(item: { itemId: string; itemName: string }): void {
    this.event("remove_from_cart", {
      item_id: item.itemId,
      item_name: item.itemName,
    });
  }

  trackViewCart(data?: {
    itemsCount?: number;
    value?: number;
    currency?: string;
  }): void {
    const props: EventProperties = {};
    if (data?.itemsCount !== undefined) props.items_count = data.itemsCount;
    if (data?.value !== undefined) props.value = data.value;
    if (data?.currency) props.currency = data.currency;
    this.event("view_cart", Object.keys(props).length > 0 ? props : undefined);
  }

  trackViewItem(item: {
    itemId: string;
    itemName: string;
    category?: string;
    price?: number;
  }): void {
    this.event("view_item", {
      item_id: item.itemId,
      item_name: item.itemName,
      ...(item.category && { category: item.category }),
      ...(item.price !== undefined && { price: item.price }),
    });
  }

  trackSearch(searchTerm: string, resultsCount?: number): void {
    this.event("search", {
      search_term: searchTerm,
      ...(resultsCount !== undefined && { results_count: resultsCount }),
    });
  }

  trackShare(data?: {
    method?: string;
    contentType?: string;
    itemId?: string;
  }): void {
    const props: EventProperties = {};
    if (data?.method) props.method = data.method;
    if (data?.contentType) props.content_type = data.contentType;
    if (data?.itemId) props.item_id = data.itemId;
    this.event("share", Object.keys(props).length > 0 ? props : undefined);
  }

  trackBeginCheckout(data?: {
    value?: number;
    currency?: string;
    itemsCount?: number;
  }): void {
    const props: EventProperties = {};
    if (data?.value !== undefined) props.value = data.value;
    if (data?.currency) props.currency = data.currency;
    if (data?.itemsCount !== undefined) props.items_count = data.itemsCount;
    this.event("begin_checkout", Object.keys(props).length > 0 ? props : undefined);
  }

  trackGenerateLead(source?: string, value?: number): void {
    const props: EventProperties = {};
    if (source) props.source = source;
    if (value !== undefined) props.value = value;
    this.event("generate_lead", Object.keys(props).length > 0 ? props : undefined);
  }

  trackContactForm(formId?: string, formName?: string): void {
    const props: EventProperties = {};
    if (formId) props.form_id = formId;
    if (formName) props.form_name = formName;
    this.event("contact_form_submit", Object.keys(props).length > 0 ? props : undefined);
  }

  trackNewsletter(source?: string): void {
    this.event("newsletter_subscribe", source ? { source } : undefined);
  }

  trackFileDownload(fileName: string, fileExtension?: string): void {
    this.event("file_download", {
      file_name: fileName,
      ...(fileExtension && { file_extension: fileExtension }),
    });
  }

  trackClickCta(button?: string, location?: string): void {
    const props: EventProperties = {};
    if (button) props.button = button;
    if (location) props.location = location;
    this.event("click_cta", Object.keys(props).length > 0 ? props : undefined);
  }

  trackVideoPlay(data?: {
    videoId?: string;
    videoTitle?: string;
    duration?: number;
  }): void {
    const props: EventProperties = {};
    if (data?.videoId) props.video_id = data.videoId;
    if (data?.videoTitle) props.video_title = data.videoTitle;
    if (data?.duration !== undefined) props.duration = data.duration;
    this.event("video_play", Object.keys(props).length > 0 ? props : undefined);
  }

  trackScrollDepth(percent: number, page?: string): void {
    this.event("scroll_depth", {
      percent,
      ...(page && { page }),
    });
  }

  trackComment(pageId?: string, pageTitle?: string): void {
    const props: EventProperties = {};
    if (pageId) props.page_id = pageId;
    if (pageTitle) props.page_title = pageTitle;
    this.event("comment_submit", Object.keys(props).length > 0 ? props : undefined);
  }

  trackRating(rating: number, itemId?: string, maxRating?: number): void {
    this.event("rating_submit", {
      rating,
      ...(itemId && { item_id: itemId }),
      ...(maxRating !== undefined && { max_rating: maxRating }),
    });
  }

  trackAddToWishlist(item: {
    itemId: string;
    itemName: string;
    price?: number;
  }): void {
    this.event("add_to_wishlist", {
      item_id: item.itemId,
      item_name: item.itemName,
      ...(item.price !== undefined && { price: item.price }),
    });
  }

  trackViewPromotion(data?: {
    promotionId?: string;
    promotionName?: string;
    location?: string;
  }): void {
    const props: EventProperties = {};
    if (data?.promotionId) props.promotion_id = data.promotionId;
    if (data?.promotionName) props.promotion_name = data.promotionName;
    if (data?.location) props.location = data.location;
    this.event("view_promotion", Object.keys(props).length > 0 ? props : undefined);
  }

  trackSelectPromotion(promotionId?: string, promotionName?: string): void {
    const props: EventProperties = {};
    if (promotionId) props.promotion_id = promotionId;
    if (promotionName) props.promotion_name = promotionName;
    this.event("select_promotion", Object.keys(props).length > 0 ? props : undefined);
  }

  trackRefund(transactionId: string, value?: number, currency?: string): void {
    this.event("refund", {
      transaction_id: transactionId,
      ...(value !== undefined && { value }),
      ...(currency && { currency }),
    });
  }

  // ===========================================================================
  // USER IDENTITY
  // ===========================================================================

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!userId) {
      warn("User ID is required for identify()");
      return;
    }
    if (!this.isReady()) {
      enqueue("identify", [userId, traits]);
      return;
    }
    this.rybbit!.identify(userId, traits);
    log("Identify:", userId);
  }

  setTraits(traits: Record<string, unknown>): void {
    if (!this.isReady()) {
      enqueue("setTraits", [traits]);
      return;
    }
    if (this.rybbit!.setTraits) {
      this.rybbit!.setTraits(traits);
    }
  }

  clearUserId(): void {
    if (!this.isReady()) return;
    this.rybbit!.clearUserId();
    log("User ID cleared");
  }

  getUserId(): string | null {
    if (!this.isReady()) return null;
    return this.rybbit!.getUserId();
  }

  // ===========================================================================
  // SESSION REPLAY
  // ===========================================================================

  startReplay(): void {
    if (!this.isReady()) return;
    this.rybbit!.startSessionReplay?.();
  }

  stopReplay(): void {
    if (!this.isReady()) return;
    this.rybbit!.stopSessionReplay?.();
  }

  isReplayActive(): boolean {
    if (!this.isReady()) return false;
    return this.rybbit!.isSessionReplayActive?.() ?? false;
  }

  // ===========================================================================
  // GLOBAL PROPERTIES
  // ===========================================================================

  setGlobalProperty(key: string, value: string | number | boolean): void {
    this.globalProps[key] = value;
  }

  removeGlobalProperty(key: string): void {
    delete this.globalProps[key];
  }

  // ===========================================================================
  // LIFECYCLE
  // ===========================================================================

  onReady(callback: ReadyCallback): void {
    if (this.state === "ready") {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  onEvent(callback: EventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
    };
  }

  onPageChange(
    callback: (path: string, previousPath: string) => void
  ): () => void {
    if (!this.isReady() || !this.rybbit!.onPageChange) {
      warn("onPageChange requires SDK to be ready and native support");
      return () => {};
    }
    return this.rybbit!.onPageChange(callback);
  }

  isReady(): boolean {
    return this.state === "ready" && this.rybbit !== null;
  }

  getState(): BootState {
    return this.state;
  }

  destroy(): void {
    teardownAutoTrack();
    teardownGtmBridge();
    this.rybbit?.cleanup?.();
    clearQueue();
    this.state = "idle";
    this.rybbit = null;
    this.config = null;
    this.readyCallbacks = [];
    this.eventListeners = [];
    this.globalProps = {};
    log("SDK destroyed");
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  private mergeProperties(
    properties?: EventProperties
  ): EventProperties | undefined {
    const hasGlobal = Object.keys(this.globalProps).length > 0;
    if (!hasGlobal && !properties) return undefined;
    if (!hasGlobal) return properties;
    if (!properties) return { ...this.globalProps };
    return { ...this.globalProps, ...properties };
  }

  private notifyListeners(
    eventName: string,
    properties?: EventProperties
  ): void {
    for (const listener of this.eventListeners) {
      try {
        listener(eventName, properties);
      } catch (e) {
        warn("Error in event listener:", e);
      }
    }
  }

  private flushQueue(): void {
    if (!this.isReady()) return;

    flush((event: QueuedEvent) => {
      const { method, args } = event;
      switch (method) {
        case "event":
          this.rybbit!.event(args[0] as string, args[1] as EventProperties);
          break;
        case "pageview":
          this.rybbit!.pageview(args[0] as string | undefined);
          break;
        case "trackOutbound":
          this.rybbit!.trackOutbound(
            args[0] as string,
            args[1] as string,
            args[2] as string
          );
          break;
        case "identify":
          this.rybbit!.identify(
            args[0] as string,
            args[1] as Record<string, unknown>
          );
          break;
        case "setTraits":
          this.rybbit!.setTraits?.(args[0] as Record<string, unknown>);
          break;
        case "trackError":
          this.trackError(
            args[0] as Error,
            args[1] as EventProperties | undefined
          );
          break;
        default:
          warn(`Unknown queued method: ${method}`);
      }
    });
  }

  private autoIdentifyFromDom(): void {
    if (typeof document === "undefined") return;

    const selector =
      this.config?.identitySelector ?? "[data-nhr-user-id]";

    const el = document.querySelector(selector);
    if (el) {
      const userId =
        el.getAttribute("data-nhr-user-id") ??
        el.getAttribute("data-user-id") ??
        el.getAttribute("content") ??
        el.textContent?.trim();

      if (userId) {
        log(`Auto-identified user from DOM: ${userId}`);
        this.rybbit!.identify(userId);
      }
    }
  }

  private createDryRunProxy(): RybbitNativeAPI {
    return {
      pageview: (path?: string) => log("[DRY] pageview:", path),
      event: (name: string, props?: EventProperties) =>
        log("[DRY] event:", name, props),
      trackOutbound: (url: string) => log("[DRY] outbound:", url),
      identify: (userId: string) => log("[DRY] identify:", userId),
      clearUserId: () => log("[DRY] clearUserId"),
      getUserId: () => null,
      error: (err: Error | ErrorEvent) =>
        log("[DRY] error:", err instanceof Error ? err.message : "ErrorEvent"),
      startSessionReplay: () => log("[DRY] startReplay"),
      stopSessionReplay: () => log("[DRY] stopReplay"),
      isSessionReplayActive: () => false,
      cleanup: () => log("[DRY] cleanup"),
    };
  }
}

/** Get or create singleton instance */
export function getInstance(): NksRybbitSDK {
  if (!instance) {
    instance = new NksRybbitSDK();
  }
  return instance;
}

/** Reset singleton (for testing) */
export function resetInstance(): void {
  instance?.destroy();
  instance = null;
}
