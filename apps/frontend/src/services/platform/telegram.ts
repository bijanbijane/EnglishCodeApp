export type TelegramInsets = { top: number; right: number; bottom: number; left: number };

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
