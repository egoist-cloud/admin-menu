'use strict';

const crypto = require('node:crypto');
const { Bot, webhookCallback } = require('grammy');
const config = require('../config');
const { formatDateTime, escapeHtml } = require('./format');

let bot = null;
let webhookHandler = null;
let activeWebhookSecret = '';
let botUsername = '';
let lastError = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Telegram допускает в secret_token только A-Z, a-z, 0-9, _ и -.
// Если секрет не задан (или задан неверно), генерируем свой: он уходит в setWebhook
// и проверяется на каждом входящем апдейте, поэтому защита не слабеет.
function resolveWebhookSecret() {
  const configured = config.telegram.webhookSecret;
  if (configured && /^[A-Za-z0-9_-]{1,256}$/.test(configured)) return configured;
  return crypto.randomBytes(24).toString('hex');
}

function initTelegram() {
  if (!config.telegram.token) {
    console.warn('[telegram] бот отключён: нет TELEGRAM_BOT_TOKEN.');
    return null;
  }

  bot = new Bot(config.telegram.token);

  bot.command(['start', 'id', 'chatid'], async (ctx) => {
    await ctx.reply(
      [
        `Ваш chat_id: ${ctx.chat.id}`,
        '',
        'Вставьте это число в переменную TELEGRAM_CHAT_ID на Render.',
      ].join('\n'),
    );
  });

  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    await ctx.reply(`Я присылаю результаты тестов. Ваш chat_id: ${ctx.chat.id}`);
  });

  bot.catch((error) => {
    console.error('[telegram] ошибка обработки апдейта:', error);
  });

  activeWebhookSecret = resolveWebhookSecret();
  webhookHandler = webhookCallback(bot, 'express', { secretToken: activeWebhookSecret });

  return bot;
}

async function setupTelegramWebhook() {
  if (!bot) return false;

  if (!config.telegram.webhookUrl) {
    console.warn('[telegram] WEBHOOK_URL не задан — webhook не установлен.');
    return false;
  }
  if (!activeWebhookSecret) {
    console.warn('[telegram] webhook не установлен: бот не инициализирован.');
    return false;
  }

  try {
    const me = await bot.api.getMe();
    botUsername = me.username || '';
    console.log(`[telegram] бот @${me.username} на связи.`);
  } catch (error) {
    console.error('[telegram] не удалось проверить токен бота:', error && error.message ? error.message : error);
  }

  const url = `${config.telegram.webhookUrl}/api/telegram/webhook`;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await bot.api.setWebhook(url, {
        secret_token: activeWebhookSecret,
        drop_pending_updates: true,
        allowed_updates: ['message'],
      });
      console.log(`[telegram] webhook установлен: ${url}`);
      return true;
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.error(`[telegram] не удалось установить webhook (попытка ${attempt}/5): ${message}`);
      if (attempt < 5) await sleep(attempt * 2000);
    }
  }

  console.error('[telegram] webhook не установлен. Проверьте TELEGRAM_BOT_TOKEN и WEBHOOK_URL.');
  return false;
}

async function notifyNewSubmission({ participantName, testTitle, score, totalQuestions, createdAt }) {
  if (!bot) {
    lastError = 'Бот не запущен: проверьте TELEGRAM_BOT_TOKEN и перезапустите сервис.';
    throw new Error(lastError);
  }
  if (!config.telegram.chatId) {
    lastError = 'TELEGRAM_CHAT_ID не задан.';
    throw new Error(lastError);
  }

  const text = [
    '📝 <b>Новый результат</b>',
    `Имя: ${escapeHtml(participantName)}`,
    `Тест: ${escapeHtml(testTitle)}`,
    `Время: ${formatDateTime(createdAt)}`,
    `Результат: ${score} / ${totalQuestions}`,
  ].join('\n');

  try {
    await bot.api.sendMessage(config.telegram.chatId, text, { parse_mode: 'HTML' });
    lastError = null;
    return true;
  } catch (error) {
    lastError = error && error.message ? error.message : String(error);
    throw error;
  }
}

async function sendTestMessage() {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN не задан в Render → Environment.');
  }
  if (!bot) {
    throw new Error('Бот не инициализирован: проверьте TELEGRAM_BOT_TOKEN и перезапустите сервис.');
  }
  if (!config.telegram.chatId) {
    throw new Error('TELEGRAM_CHAT_ID не задан в Render → Environment.');
  }

  try {
    await bot.api.sendMessage(
      config.telegram.chatId,
      '✅ Проверка связи: Admin Menu отправляет результаты в этот чат.',
    );
    lastError = null;
  } catch (error) {
    lastError = error && error.message ? error.message : String(error);
    throw error;
  }
}

function getTelegramStatus() {
  const chatId = config.telegram.chatId;
  return {
    tokenConfigured: Boolean(config.telegram.token),
    chatId,
    chatIdMasked: chatId ? `${chatId.slice(0, 3)}…${chatId.slice(-3)}` : '',
    webhookUrl: config.telegram.webhookUrl,
    botUsername,
    lastError,
  };
}

function getWebhookHandler() {
  return webhookHandler;
}

module.exports = {
  initTelegram,
  setupTelegramWebhook,
  notifyNewSubmission,
  sendTestMessage,
  getTelegramStatus,
  getWebhookHandler,
};
