import { describe, expect, it } from "vitest";
import { bytesToHex, hmacSha256 } from "../src/shared/crypto";
import { telegramInitDataFingerprint, verifyTelegramInitData } from "../src/modules/auth/telegram";

async function signedInitData(botToken: string, fields: Record<string, string>) {
  const data = Object.entries(fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("\n");
  // Match Telegram's documented derivation: HMAC(key=bot token, data="WebAppData").
  const secret = await hmacSha256(new TextEncoder().encode(botToken), "WebAppData");
  const hash = bytesToHex(await hmacSha256(secret, data));
  return new URLSearchParams({ ...fields, hash }).toString();
}
describe("Telegram initData verification", () => {
  const botToken = "test-bot-token";
  const now = 1_800_000_000;
  it("accepts an independent fixed Telegram HMAC test vector", async () => {
    // Generated independently with Python stdlib hmac/hashlib, not the TS test helper.
    const raw = "auth_date=1700000000&query_id=AAEAAAE&user=%7B%22id%22%3A42%2C%22first_name%22%3A%22Ada%22%2C%22last_name%22%3A%22Lovelace%22%2C%22username%22%3A%22ada%22%7D&hash=20b862fa44b58d955965fac0b457b23e79d2a4f81eb5468c23a7aaaf98f010db";
    const result = await verifyTelegramInitData(raw, {
      botToken: "123456:ABC-DEF",
      nowSeconds: 1700000000,
      maxAgeSeconds: 3600
    });
    expect(result.user).toMatchObject({ id: "42", firstName: "Ada", lastName: "Lovelace", username: "ada" });
  });
  it("accepts a valid signature using Telegram's HMAC key/data order", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    const result = await verifyTelegramInitData(raw, { botToken, nowSeconds: now });
    expect(result.user.id).toBe("123");
  });
  it("rejects a signature derived with the reversed HMAC key/data order", async () => {
    const fields = { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) };
    const data = Object.entries(fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, value]) => `${key}=${value}`).join("\n");
    const reversedSecret = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
    const reversedHash = bytesToHex(await hmacSha256(reversedSecret, data));
    const raw = new URLSearchParams({ ...fields, hash: reversedHash }).toString();
    await expect(verifyTelegramInitData(raw, { botToken, nowSeconds: now }))
      .rejects.toMatchObject({ code: "INVALID_TELEGRAM_SIGNATURE" });
  });
  it("rejects a modified payload", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    await expect(verifyTelegramInitData(raw.replace("Test", "Other"), { botToken, nowSeconds: now }))
      .rejects.toMatchObject({ code: "INVALID_TELEGRAM_SIGNATURE" });
  });
  it("rejects expired data", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now - 7200), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    await expect(verifyTelegramInitData(raw, { botToken, nowSeconds: now, maxAgeSeconds: 3600 }))
      .rejects.toMatchObject({ code: "TELEGRAM_AUTH_EXPIRED" });
  });
  it("rejects data at the exact maximum-age boundary", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now - 3600), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    await expect(verifyTelegramInitData(raw, { botToken, nowSeconds: now, maxAgeSeconds: 3600 }))
      .rejects.toMatchObject({ code: "TELEGRAM_AUTH_EXPIRED" });
  });
  it("rejects future-dated data outside the allowed clock skew", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now + 120), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    await expect(verifyTelegramInitData(raw, { botToken, nowSeconds: now, futureSkewSeconds: 30 }))
      .rejects.toMatchObject({ code: "TELEGRAM_AUTH_EXPIRED" });
  });
  it("rejects duplicate parameters", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    await expect(verifyTelegramInitData(`${raw}&auth_date=${now}`, { botToken, nowSeconds: now }))
      .rejects.toMatchObject({ code: "INVALID_TELEGRAM_INIT_DATA" });
  });
  it("creates the same replay fingerprint regardless of query parameter order", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    const params = new URLSearchParams(raw);
    const reordered = new URLSearchParams();
    for (const key of ["user", "hash", "auth_date"]) reordered.set(key, params.get(key)!);
    expect(await telegramInitDataFingerprint(raw)).toBe(await telegramInitDataFingerprint(reordered.toString()));
  });
});
