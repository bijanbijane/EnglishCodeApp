export type TelegramInsets = { top: number; right: number; bottom: number; left: number };

type TelegramSecureStorage = {
  setItem: (key: string, value: string, callback?: (error: unknown, success?: boolean) => void) => TelegramSecureStorage;
  getItem: (key: string, callback: (error: unknown, value: string | null, canRestore?: boolean) => void) => TelegramSecureStorage;
  removeItem: (key: string, callback?: (error: string | null, success?: boolean) => void) => TelegramSecureStorage;
};

type TelegramBackButton = {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
};

type TelegramWebApp = {
  initData: string;
  platform?: string;
  version?: string;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isExpanded?: boolean;
  safeAreaInset?: TelegramInsets;
  contentSafeAreaInset?: TelegramInsets;
  BackButton?: TelegramBackButton;
  SecureStorage?: TelegramSecureStorage;
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand?: () => void;
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export type PlatformContext = {
  host: "telegram" | "browser";
  telegramVersion: string | null;
  platform: string | null;
  initData: string | null;
  colorScheme: "light" | "dark" | null;
  themeParams: Record<string, string>;
  viewportHeight: number | null;
  stableViewportHeight: number | null;
  safeArea: TelegramInsets | null;
  contentSafeArea: TelegramInsets | null;
};

const emptyInsets: TelegramInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function getPlatformContext(): PlatformContext {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  if (!webApp) {
    return {
      host: "browser",
      telegramVersion: null,
      platform: null,
      initData: null,
      colorScheme: null,
      themeParams: {},
      viewportHeight: null,
      stableViewportHeight: null,
      safeArea: null,
      contentSafeArea: null,
    };
  }

  return {
    host: "telegram",
    telegramVersion: webApp.version ?? null,
    platform: webApp.platform ?? null,
    // Keep the signed query string intact. Never use initDataUnsafe for authentication.
    initData: webApp.initData || null,
    colorScheme: webApp.colorScheme ?? null,
    themeParams: webApp.themeParams ?? {},
    viewportHeight: webApp.viewportHeight ?? null,
    stableViewportHeight: webApp.viewportStableHeight ?? null,
    safeArea: webApp.safeAreaInset ?? emptyInsets,
    contentSafeArea: webApp.contentSafeAreaInset ?? emptyInsets,
  };
}

export function initializeTelegramHost(): PlatformContext {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  if (webApp) webApp.ready();
  return getPlatformContext();
}

export function subscribeToTelegramViewport(onChange: () => void): () => void {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  if (!webApp?.onEvent || !webApp.offEvent) return () => undefined;
  webApp.onEvent("viewportChanged", onChange);
  return () => webApp.offEvent?.("viewportChanged", onChange);
}

export function setTelegramBackAction(onBack: () => void): () => void {
  const backButton = typeof window === "undefined" ? undefined : window.Telegram?.WebApp?.BackButton;
  if (!backButton) return () => undefined;
  backButton.onClick(onBack);
  backButton.show();
  return () => {
    backButton.offClick(onBack);
    backButton.hide();
  };
}

const SECURE_STORAGE_MIN_VERSION = "9.0";

export function isTelegramSecureStorageAvailable(): boolean {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  return Boolean(webApp?.SecureStorage && webApp.isVersionAtLeast?.(SECURE_STORAGE_MIN_VERSION));
}

function getSecureStorage(): TelegramSecureStorage {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
  if (!webApp?.SecureStorage || !webApp.isVersionAtLeast?.(SECURE_STORAGE_MIN_VERSION)) {
    throw new Error("نسخهٔ تلگرام یا دستگاه فعلی از SecureStorage پشتیبانی نمی‌کند.");
  }
  return webApp.SecureStorage;
}

export function getTelegramSecureItem(key: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    getSecureStorage().getItem(key, (error, value) => {
      if (error) reject(new Error("خواندن نشست امن از تلگرام ناموفق بود."));
      else resolve(value);
    });
  });
}

export function setTelegramSecureItem(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getSecureStorage().setItem(key, value, (error, success) => {
      if (error || success === false) reject(new Error("ذخیرهٔ نشست امن در تلگرام ناموفق بود."));
      else resolve();
    });
  });
}

export function removeTelegramSecureItem(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getSecureStorage().removeItem(key, (error, success) => {
      if (error || success === false) reject(new Error("پاک‌کردن نشست امن تلگرام ناموفق بود."));
      else resolve();
    });
  });
}

export function bindTelegramLayoutMetrics(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => undefined;
  const root = document.documentElement;

  const apply = () => {
    const context = getPlatformContext();
    const safe = context.contentSafeArea ?? context.safeArea ?? emptyInsets;
    root.style.setProperty("--telegram-safe-top", safe.top + "px");
    root.style.setProperty("--telegram-safe-right", safe.right + "px");
    root.style.setProperty("--telegram-safe-bottom", safe.bottom + "px");
    root.style.setProperty("--telegram-safe-left", safe.left + "px");
    if (context.stableViewportHeight) root.style.setProperty("--telegram-stable-viewport-height", context.stableViewportHeight + "px");
    else root.style.removeProperty("--telegram-stable-viewport-height");
    if (context.colorScheme) root.dataset.telegramTheme = context.colorScheme;
    else delete root.dataset.telegramTheme;

    const themeKeys: Record<string, string> = {
      "--telegram-theme-bg": "bg_color",
      "--telegram-theme-text": "text_color",
      "--telegram-theme-hint": "hint_color",
      "--telegram-theme-link": "link_color",
      "--telegram-theme-button": "button_color",
      "--telegram-theme-button-text": "button_text_color",
      "--telegram-theme-secondary-bg": "secondary_bg_color",
    };
    for (const [cssName, themeKey] of Object.entries(themeKeys)) {
      const value = context.themeParams[themeKey];
      if (value && /^#[0-9a-f]{6}$/i.test(value)) root.style.setProperty(cssName, value);
      else root.style.removeProperty(cssName);
    }
  };

  const webApp = window.Telegram?.WebApp;
  const events = ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "themeChanged"];
  apply();
  events.forEach((event) => webApp?.onEvent?.(event, apply));
  return () => {
    events.forEach((event) => webApp?.offEvent?.(event, apply));
    [
      "--telegram-safe-top", "--telegram-safe-right", "--telegram-safe-bottom", "--telegram-safe-left",
      "--telegram-stable-viewport-height", "--telegram-theme-bg", "--telegram-theme-text",
      "--telegram-theme-hint", "--telegram-theme-link", "--telegram-theme-button",
      "--telegram-theme-button-text", "--telegram-theme-secondary-bg",
    ].forEach((name) => root.style.removeProperty(name));
    delete root.dataset.telegramTheme;
  };
}
