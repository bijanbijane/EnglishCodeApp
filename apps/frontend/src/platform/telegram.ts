export type TelegramSecureStorage = {
  getItem: (key: string, callback: (error: string | null, value: string | null, canRestore?: boolean) => void) => void;
  setItem: (key: string, value: string, callback: (error: string | null, stored?: boolean) => void) => void;
  removeItem: (key: string, callback: (error: string | null, removed?: boolean) => void) => void;
};

export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  SecureStorage?: TelegramSecureStorage;
  colorScheme?: "light" | "dark";
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/**
 * Returns the Telegram host bridge when the app runs inside a supported
 * Telegram WebView. Browser clients deliberately receive undefined.
 */
export function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return window.Telegram?.WebApp;
}
