import { describe, expect, it, vi } from "vitest";
import { ApiError, type Profile } from "../src/api";
import { restoreSession, revokeSession, type SessionStorage } from "../src/auth";

const profile: Profile = { id: "user-1", display_name: "Learner", created_at: "2026-11-27T00:00:00.000Z" };

function makeStorage(initial: string | null = null) {
  let token = initial;
  const storage: SessionStorage = {
    getItem: vi.fn((_key, callback) => callback(null, token)),
    setItem: vi.fn((_key, value, callback) => { token = value; callback(null, true); }),
    removeItem: vi.fn((_key, callback) => { token = null; callback(null, true); }),
  };
  return { storage, value: () => token };
}

describe("secure session lifecycle", () => {
  it("restores a valid saved session without logging in again", async () => {
    const store = makeStorage("saved-token");
    const setToken = vi.fn();
    const login = vi.fn();
    const result = await restoreSession({
      storage: store.storage, initData: "telegram-init-data",
      profile: vi.fn().mockResolvedValue(profile), login, setToken,
    });

    expect(result).toEqual(profile);
    expect(setToken).toHaveBeenCalledWith("saved-token");
    expect(login).not.toHaveBeenCalled();
    expect(store.value()).toBe("saved-token");
  });

  it("re-authenticates only after a definitive 401 and replaces the saved token", async () => {
    const store = makeStorage("expired-token");
    const setToken = vi.fn();
    const profileRequest = vi.fn()
      .mockRejectedValueOnce(new ApiError("Unauthorized", 401, "UNAUTHENTICATED"))
      .mockResolvedValueOnce(profile);
    const login = vi.fn().mockResolvedValue({ accessToken: "fresh-token" });

    const result = await restoreSession({
      storage: store.storage, initData: "telegram-init-data",
      profile: profileRequest, login, setToken,
    });

    expect(result).toEqual(profile);
    expect(store.value()).toBe("fresh-token");
    expect(login).toHaveBeenCalledWith("telegram-init-data");
    expect(setToken.mock.calls).toEqual([["expired-token"], [null], ["fresh-token"]]);
  });

  it("preserves the saved token and does not trigger login on a 503", async () => {
    const store = makeStorage("saved-token");
    const setToken = vi.fn();
    const login = vi.fn();

    await expect(restoreSession({
      storage: store.storage, initData: "telegram-init-data",
      profile: vi.fn().mockRejectedValue(new ApiError("Unavailable", 503, "SERVICE_UNAVAILABLE")),
      login, setToken,
    })).rejects.toMatchObject({ status: 503 });

    expect(store.value()).toBe("saved-token");
    expect(setToken).toHaveBeenCalledWith("saved-token");
    expect(login).not.toHaveBeenCalled();
    expect(store.storage.removeItem).not.toHaveBeenCalled();
  });

  it("preserves the saved token and does not trigger login on a network failure", async () => {
    const store = makeStorage("saved-token");
    const login = vi.fn();

    await expect(restoreSession({
      storage: store.storage, initData: "telegram-init-data",
      profile: vi.fn().mockRejectedValue(new TypeError("Network unavailable")),
      login, setToken: vi.fn(),
    })).rejects.toThrow("Network unavailable");

    expect(store.value()).toBe("saved-token");
    expect(login).not.toHaveBeenCalled();
    expect(store.storage.removeItem).not.toHaveBeenCalled();
  });

  it("does not clear local credentials when server logout fails", async () => {
    const store = makeStorage("saved-token");
    const setToken = vi.fn();

    await expect(revokeSession({
      storage: store.storage,
      logout: vi.fn().mockRejectedValue(new Error("Server unavailable")),
      setToken,
    })).rejects.toThrow("Server unavailable");

    expect(store.value()).toBe("saved-token");
    expect(setToken).not.toHaveBeenCalled();
    expect(store.storage.removeItem).not.toHaveBeenCalled();
  });

  it("revokes the server session before clearing local credentials", async () => {
    const store = makeStorage("saved-token");
    const setToken = vi.fn();
    const logout = vi.fn().mockResolvedValue({ loggedOut: true });

    await expect(revokeSession({ storage: store.storage, logout, setToken })).resolves.toEqual({ storageCleared: true });

    expect(logout).toHaveBeenCalledOnce();
    expect(setToken).toHaveBeenCalledWith(null);
    expect(store.value()).toBeNull();
    expect(store.storage.removeItem).toHaveBeenCalledOnce();
  });

  it("still completes sign-out when secure-storage cleanup fails after server revocation", async () => {
    const store = makeStorage("saved-token");
    store.storage.removeItem = vi.fn((_key, callback) => callback("Storage unavailable"));
    const setToken = vi.fn();
    const logout = vi.fn().mockResolvedValue({ loggedOut: true });

    await expect(revokeSession({ storage: store.storage, logout, setToken })).resolves.toEqual({ storageCleared: false });

    expect(logout).toHaveBeenCalledOnce();
    expect(setToken).toHaveBeenCalledWith(null);
    expect(store.value()).toBe("saved-token");
  });
  it("fails closed when Telegram does not provide fresh initData", async () => {
    const store = makeStorage(null);
    const login = vi.fn();

    await expect(restoreSession({
      storage: store.storage, initData: "",
      profile: vi.fn(), login, setToken: vi.fn(),
    })).rejects.toThrow("Telegram did not provide authentication data.");

    expect(login).not.toHaveBeenCalled();
    expect(store.storage.setItem).not.toHaveBeenCalled();
  });

  it("does not log in when secure storage cannot read the saved token", async () => {
    const store = makeStorage(null);
    store.storage.getItem = vi.fn((_key, callback) => callback("Storage unavailable", null));
    const login = vi.fn();

    await expect(restoreSession({
      storage: store.storage, initData: "telegram-init-data",
      profile: vi.fn(), login, setToken: vi.fn(),
    })).rejects.toThrow("Could not read the secure session.");

    expect(login).not.toHaveBeenCalled();
  });

  it("does not activate a session when secure storage cannot persist a new token", async () => {
    const store = makeStorage(null);
    store.storage.setItem = vi.fn((_key, _value, callback) => callback("Storage unavailable", false));
    const setToken = vi.fn();
    const login = vi.fn().mockResolvedValue({ accessToken: "fresh-token" });

    await expect(restoreSession({
      storage: store.storage, initData: "telegram-init-data",
      profile: vi.fn(), login, setToken,
    })).rejects.toThrow("Could not save the secure session.");

    expect(login).toHaveBeenCalledOnce();
    expect(setToken).not.toHaveBeenCalled();
    expect(store.storage.setItem).toHaveBeenCalledOnce();
  });

});
