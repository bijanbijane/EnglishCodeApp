import { Hono } from "hono";
import type { AppEnv } from "../../env";

const telegram = new Hono<AppEnv>();

type TelegramMessage = {
  text?: string;
  chat?: { id?: number; type?: string };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
};

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function responseText(text: string): string {
  if (text.trim() === "/start" || text.trim().startsWith("/start ")) {
    return "Welcome to EnglishCode. Your Telegram bot is connected. Learning features are being prepared.";
  }
  if (text.trim() === "/help") {
    return "EnglishCode bot is online. Send /start to check the connection.";
  }
  return "Message received. EnglishCode Telegram learning features are being prepared.";
}

telegram.post("/telegram/webhook", async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = c.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !webhookSecret) {
    return c.json({ error: "Telegram webhook is not configured." }, 503);
  }

  const suppliedSecret = c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!constantTimeEqual(suppliedSecret, webhookSecret)) {
    return c.json({ error: "Unauthorized." }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.json({ error: "Invalid JSON." }, 400);
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text;

  // Ignore non-text updates and group messages for the first development release.
  if (
    !Number.isSafeInteger(chatId) ||
    typeof text !== "string" ||
    text.length === 0 ||
    message?.chat?.type !== "private"
  ) {
    return c.json({ ok: true });
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: responseText(text.slice(0, 4096)),
      disable_web_page_preview: true,
    }),
  });

  if (!telegramResponse.ok) {
    // Do not expose Telegram's response or bot token in logs or API output.
    return c.json({ error: "Telegram delivery failed." }, 502);
  }

  const result = await telegramResponse.json() as { ok?: boolean };
  if (result.ok !== true) {
    return c.json({ error: "Telegram delivery failed." }, 502);
  }

  return c.json({ ok: true });
});

export default telegram;
