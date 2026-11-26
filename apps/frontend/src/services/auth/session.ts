import { getPlatformContext } from "../platform/telegram";
import { getTelegramSecureItem, removeTelegramSecureItem, setTelegramSecureItem } from "../platform/telegram";

const SESSION_STORAGE_KEY = "englishcode_session_v1";
const EXPIRY_SKEW_MS = 30_000;

export type AuthSession = { token: string; expiresAt: string };
let memorySession: AuthSession | null = null;
const invalidationListeners = new Set<() => void>();

export function subscribeToSessionInvalidation(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
}

function isValidSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === "string" && candidate.token.length >= 32 &&
    typeof candidate.expiresAt === "string" && Number.isFinite(Date.parse(candidate.expiresAt)) &&
    Date.parse(candidate.expiresAt) > Date.now() + EXPIRY_SKEW_MS;
}

export async function readSession(): Promise<AuthSession | null> {
  if (isValidSession(memorySession)) return memorySession;
  memorySession = null;
  if (getPlatformContext().host !== "telegram") return null;

  const raw = await getTelegramSecureItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidSession(parsed)) {
      memorySession = parsed;
      return parsed;
    }
  } catch {
    // Invalid stored content is treated as an absent session.
  }
  await removeTelegramSecureItem(SESSION_STORAGE_KEY);
  return null;
}

export async function saveSession(session: AuthSession): Promise<void> {
  if (!isValidSession(session)) throw new Error("پاسخ نشست از سرور معتبر نیست.");
  if (getPlatformContext().host !== "telegram") {
    throw new Error("ورود امن مرورگر تا زمان پشتیبانی نشست سمت سرور فعال نیست.");
  }
  await setTelegramSecureItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  memorySession = session;
}

export async function clearSession(): Promise<void> {
  memorySession = null;
  invalidationListeners.forEach((listener) => listener());
  if (getPlatformContext().host === "telegram") {
    await removeTelegramSecureItem(SESSION_STORAGE_KEY);
  }
}

export async function getSessionToken(): Promise<string> {
  const session = await readSession();
  if (!session) throw new Error("نشست معتبر پیدا نشد؛ برنامه را از داخل تلگرام باز کن.");
  return session.token;
}
