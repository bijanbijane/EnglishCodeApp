import { describe, expect, it } from "vitest";
import { bytesToHex, hmacSha256 } from "../src/shared/crypto";
import { verifyTelegramInitData } from "../src/modules/auth/telegram";

async function signedInitData(botToken: string, fields: Record<string, string>) {
  const data = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmacSha256(new TextEncoder().encode(botToken), "WebAppData");
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
  it("rejects duplicate parameters", async () => {
    const raw = await signedInitData(botToken, { auth_date: String(now), user: JSON.stringify({ id: 123, first_name: "Test" }) });
    await expect(verifyTelegramInitData(`${raw}&auth_date=${now}`, { botToken, nowSeconds: now }))
      .rejects.toMatchObject({ code: "INVALID_TELEGRAM_INIT_DATA" });
  });
});
