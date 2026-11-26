import { describe, expect, it } from "vitest";
import {
  TelegramInitDataError,
  validateTelegramInitData,
} from "../src/modules/auth/telegram";

const botToken = "123456:TEST_BOT_TOKEN";
const validParams = new URLSearchParams({
  auth_date: "1735689600",
  query_id: "AAEAAE",
  user: JSON.stringify({ id: 123456789, first_name: "Test", username: "test_user" }),
  hash: "14281dde18173991a31213ec6e803f3c7b9723946be1c5a59f1a318f049f16b8",
});

describe("Telegram Mini App initData validation", () => {
  it("accepts an independently generated HMAC test vector", async () => {
    const result = await validateTelegramInitData(validParams.toString(), botToken, {
      nowSeconds: 1735689600,
    });
    expect(result.userId).toBe("123456789");
    expect(result.user.first_name).toBe("Test");
    expect(result.replayFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a tampered field", async () => {
    const tampered = new URLSearchParams(validParams);
    tampered.set("query_id", "tampered");
    await expect(
      validateTelegramInitData(tampered.toString(), botToken, { nowSeconds: 1735689600 }),
    ).rejects.toBeInstanceOf(TelegramInitDataError);
  });

  it("rejects expired authentication data", async () => {
    await expect(
      validateTelegramInitData(validParams.toString(), botToken, {
        nowSeconds: 1735690000,
        maxAgeSeconds: 300,
      }),
    ).rejects.toThrow("expired");
  });

  it("rejects future-dated authentication data", async () => {
    await expect(
      validateTelegramInitData(validParams.toString(), botToken, {
        nowSeconds: 1735689000,
        futureSkewSeconds: 30,
      }),
    ).rejects.toThrow("expired");
  });

  it("rejects duplicate parameters before signature validation", async () => {
    const duplicate = `${validParams.toString()}&auth_date=1735689600`;
    await expect(
      validateTelegramInitData(duplicate, botToken, { nowSeconds: 1735689600 }),
    ).rejects.toThrow("Duplicate");
  });
});
