type TelegramWebhookMessage = {
  chatId: string;
  text: string;
  messageId?: string;
  from?: string;
};

function trimValue(value: string | undefined | null) {
  return (value || "").trim();
}

function parseAllowedChatIds(raw: string | undefined) {
  return new Set(
    trimValue(raw)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function getTelegramConfig() {
  const botToken = trimValue(process.env.TELEGRAM_BOT_TOKEN);
  const defaultChatId = trimValue(process.env.TELEGRAM_DEFAULT_CHAT_ID);
  const webhookSecret = trimValue(process.env.TELEGRAM_WEBHOOK_SECRET);
  const allowedChatIds = parseAllowedChatIds(process.env.TELEGRAM_ALLOWED_CHAT_IDS);

  return {
    enabled: Boolean(botToken),
    botToken,
    defaultChatId,
    webhookSecret,
    allowedChatIds,
  };
}

export function getTelegramStatus() {
  const config = getTelegramConfig();
  return {
    enabled: config.enabled,
    configured: Boolean(config.botToken && config.defaultChatId),
    defaultChatId: config.defaultChatId || null,
    allowedChatIds: [...config.allowedChatIds],
    webhookSecretConfigured: Boolean(config.webhookSecret),
  };
}

export function extractTelegramWebhookMessage(update: any): TelegramWebhookMessage | null {
  const message = update?.message || update?.edited_message || update?.channel_post || null;
  if (!message?.chat?.id) return null;
  const text = trimValue(message.text || message.caption || "");
  if (!text) return null;
  const from = message.from?.username || message.from?.first_name || message.from?.id;
  return {
    chatId: String(message.chat.id),
    text,
    messageId: message.message_id ? String(message.message_id) : undefined,
    from: from ? String(from) : undefined,
  };
}

export function isTelegramChatAllowed(chatId: string) {
  const config = getTelegramConfig();
  if (config.allowedChatIds.size === 0) return true;
  return config.allowedChatIds.has(String(chatId));
}

export async function sendTelegramTextMessage(chatId: string, text: string) {
  const config = getTelegramConfig();
  if (!config.botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required.");
  }
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Telegram API responded ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`);
  }
  if (!body) return { ok: true };
  try {
    return JSON.parse(body);
  } catch {
    return { ok: true, raw: body };
  }
}
