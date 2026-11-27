import { Hono } from "hono";
import type { AppEnv } from "../../env";

const telegram = new Hono<AppEnv>();
const WEBHOOK_URL = "https://englishcode-backend-dev.bijanbijane-1.workers.dev/api/v1/telegram/webhook";

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

const setupPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>EnglishCode Telegram setup</title>
</head>
<body>
<main>
<h1>EnglishCode Telegram setup</h1>
<p id="status">Checking the one-time setup link…</p>
<pre id="result" aria-live="polite"></pre>
</main>
<script>
(async () => {
  const status = document.getElementById("status");
  const result = document.getElementById("result");
  const key = location.hash.slice(1);
  history.replaceState(null, "", location.pathname);
  if (!key) {
    status.textContent = "Setup key is missing. Open the complete setup link provided in the ChatGPT conversation.";
    return;
  }
  status.textContent = "Registering and verifying the Telegram webhook…";
  try {
    const response = await fetch(location.pathname, {
      method: "POST",
      headers: { "X-EnglishCode-Setup-Token": key }
    });
    const data = await response.json();
    result.textContent = JSON.stringify(data, null, 2);
    status.textContent = response.ok && data.ok === true
      ? "Webhook setup completed."
      : "Webhook setup failed. Share the result with the project assistant.";
  } catch (error) {
    status.textContent = "Request failed. Retry once or share this error with the project assistant.";
    result.textContent = String(error);
  }
})();
</script>
</body>
</html>`;

telegram.get("/telegram/setup", (c) => {
  if (!c.env.TELEGRAM_SETUP_KEY) {
    return c.text("Telegram setup is not configured.", 503);
  }
  return new Response(setupPage, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// Temporary bootstrap requires a separate, high-entropy setup key.
// The key is sent in a request header, never in the URL or request body.
telegram.post("/telegram/setup", async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = c.env.TELEGRAM_WEBHOOK_SECRET;
  const setupKey = c.env.TELEGRAM_SETUP_KEY;
  if (!token || !webhookSecret || !setupKey) {
    return c.json({ error: "Telegram setup is not configured." }, 503);
  }

  const suppliedSetupSecret = c.req.header("X-EnglishCode-Setup-Token") ?? "";
  if (!constantTimeEqual(suppliedSetupSecret, setupKey)) {
    return c.json({ error: "Unauthorized." }, 401);
  }

  const infoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
  const infoResponse = await fetch(infoUrl);
  if (!infoResponse.ok) {
    return c.json({ error: "Telegram webhook status could not be read." }, 502);
  }
  const info = await infoResponse.json() as {
    ok?: boolean;
    result?: { url?: string; pending_update_count?: number; allowed_updates?: string[] };
  };
  if (info.ok !== true) {
    return c.json({ error: "Telegram webhook status could not be read." }, 502);
  }

  let status = "already_registered";
  if (info.result?.url !== WEBHOOK_URL) {
    const setResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret_token: webhookSecret,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    });
    if (!setResponse.ok) {
      return c.json({ error: "Telegram webhook registration failed." }, 502);
    }
    const setResult = await setResponse.json() as { ok?: boolean };
    if (setResult.ok !== true) {
      return c.json({ error: "Telegram webhook registration failed." }, 502);
    }
    status = "registered";
  }

  const verifiedResponse = await fetch(infoUrl);
  if (!verifiedResponse.ok) {
    return c.json({ error: "Telegram webhook verification failed." }, 502);
  }
  const verified = await verifiedResponse.json() as {
    ok?: boolean;
    result?: { url?: string; pending_update_count?: number; allowed_updates?: string[] };
  };
  if (verified.ok !== true || verified.result?.url !== WEBHOOK_URL) {
    return c.json({ error: "Telegram webhook verification failed." }, 502);
  }

  return c.json({
    ok: true,
    webhook: status,
    url: verified.result.url,
    pendingUpdateCount: verified.result.pending_update_count ?? 0,
    allowedUpdates: verified.result.allowed_updates ?? [],
  });
});

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
  if (typeof update !== "object" || update === null) {
    return c.json({ error: "Invalid update." }, 400);
  }
  if (!Number.isSafeInteger(update.update_id) || (update.update_id ?? -1) < 0) {
    return c.json({ error: "A valid Telegram update_id is required." }, 400);
  }

  const updateId = update.update_id as number;
  const claim = await c.env.DB.prepare(
    `INSERT INTO telegram_webhook_updates (update_id, status, updated_at)
     VALUES (?, 'processing', unixepoch())
     ON CONFLICT(update_id) DO UPDATE SET
       status = 'processing',
       updated_at = unixepoch()
     WHERE telegram_webhook_updates.status = 'processing'
       AND telegram_webhook_updates.updated_at < unixepoch() - 300`,
  ).bind(updateId).run();

  if (claim.meta.changes !== 1) {
    const existing = await c.env.DB.prepare(
      "SELECT status FROM telegram_webhook_updates WHERE update_id = ? LIMIT 1",
    ).bind(updateId).first<{ status: string }>();
    if (existing?.status === "processed") {
      return c.json({ ok: true, duplicate: true });
    }
    return c.json({ error: "Telegram update is already being processed." }, 503);
  }

  const completeUpdate = async () => {
    const result = await c.env.DB.prepare(
      `UPDATE telegram_webhook_updates
       SET status = 'processed', updated_at = unixepoch()
       WHERE update_id = ? AND status = 'processing'`,
    ).bind(updateId).run();
    if (result.meta.changes !== 1) {
      throw new Error("Telegram update claim could not be completed.");
    }
  };

  const releaseUpdate = async () => {
    await c.env.DB.prepare(
      "DELETE FROM telegram_webhook_updates WHERE update_id = ? AND status = 'processing'",
    ).bind(updateId).run();
  };

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text;

  if (
    !Number.isSafeInteger(chatId) ||
    typeof text !== "string" ||
    text.length === 0 ||
    message?.chat?.type !== "private"
  ) {
    await completeUpdate();
    return c.json({ ok: true });
  }

  let telegramResponse: Response;
  try {
    telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: responseText(text.slice(0, 4096)),
        disable_web_page_preview: true,
      }),
    });
    if (!telegramResponse.ok) {
      await releaseUpdate();
      return c.json({ error: "Telegram delivery failed." }, 502);
    }
    const result = await telegramResponse.json() as { ok?: boolean };
    if (result.ok !== true) {
      await releaseUpdate();
      return c.json({ error: "Telegram delivery failed." }, 502);
    }
  } catch {
    await releaseUpdate();
    return c.json({ error: "Telegram delivery failed." }, 502);
  }

  await completeUpdate();
  return c.json({ ok: true });
});

export default telegram;
