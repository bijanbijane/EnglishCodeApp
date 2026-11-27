import { ApiError } from "./api";
import type { Profile } from "./api";

export type SessionStorage = {
  getItem(key: string, callback: (error: string | null, value: string | null) => void): void;
  setItem(key: string, value: string, callback: (error: string | null, stored?: boolean) => void): void;
  removeItem(key: string, callback: (error: string | null, removed?: boolean) => void): void;
};

function readToken(storage: SessionStorage): Promise<string | null> {
  return new Promise((resolve, reject) => storage.getItem("englishcode_session", (error, value) => {
    if (error) reject(new Error("Could not read the secure session."));
    else resolve(value);
  }));
}

function saveToken(storage: SessionStorage, token: string): Promise<void> {
  return new Promise((resolve, reject) => storage.setItem("englishcode_session", token, (error, stored) => {
    if (error || stored === false) reject(new Error("Could not save the secure session."));
    else resolve();
  }));
}

function removeToken(storage: SessionStorage): Promise<void> {
  return new Promise((resolve, reject) => storage.removeItem("englishcode_session", (error) => {
    if (error) reject(new Error("Could not remove the secure session."));
    else resolve();
  }));
}

export function getSessionErrorMessage(error: unknown): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 409)) {
    return "Telegram sign-in data has expired or was already used. Close and reopen the Mini App to refresh it.";
  }
  if (error instanceof TypeError) {
    return "Could not reach EnglishCode. Check your connection. If sign-in was interrupted, close and reopen the Mini App to refresh Telegram authentication data.";
  }
  return error instanceof Error ? error.message : "Telegram sign-in is unavailable.";
}

export async function restoreSession(deps: {
  storage: SessionStorage;
  initData: string;
  profile: () => Promise<Profile>;
  login: (initData: string) => Promise<{ accessToken: string }>;
  setToken: (token: string | null) => void;
}): Promise<Profile> {
  const savedToken = await readToken(deps.storage);
  if (savedToken) {
    deps.setToken(savedToken);
    try {
      return await deps.profile();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await removeToken(deps.storage);
      deps.setToken(null);
    }
  }

  if (!deps.initData) throw new Error("Telegram did not provide authentication data.");
  const result = await deps.login(deps.initData);
  await saveToken(deps.storage, result.accessToken);
  deps.setToken(result.accessToken);
  return deps.profile();
}

export async function revokeSession(deps: {
  storage: SessionStorage;
  logout: () => Promise<unknown>;
  setToken: (token: string | null) => void;
}): Promise<{ storageCleared: boolean }> {
  await deps.logout();
  deps.setToken(null);
  try {
    await removeToken(deps.storage);
    return { storageCleared: true };
  } catch {
    // The server session is already revoked; local UI must still transition to signed-out.
    return { storageCleared: false };
  }
}
