import { describe, expect, it } from "vitest";
import { bytesToHex, hmacSha256 } from "../src/shared/crypto";
import { telegramInitDataFingerprint, verifyTelegramInitData } from "../src/modules/auth/telegram";

async function signedInitData(botToken: string, fields: Record<string, string>) {
  const data = Object.entries(fields).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const hash = bytesToHex(await hmacSha256(secret, data));
  return new URLSearchParams({ ...fields, hash }).toString();
}
describe("Telegram initData verification", () => {
  const botToken = "test-bot-token";
  const now = 1_800_000_000;
  it("accepts a valid signature", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    const result = await verifyTelegramInitData(raw, { botToken, nowSeconds: now });
    expect(result.user.id).toBe("123");
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
