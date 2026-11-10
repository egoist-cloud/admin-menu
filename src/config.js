'use strict';

require('dotenv').config();

const path = require('node:path');

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const nodeEnv = text(process.env.NODE_ENV) || 'development';
const isProduction = nodeEnv === 'production';

const parsedPort = Number.parseInt(process.env.PORT || '3000', 10);

const config = {
  nodeEnv,
  isProduction,
  port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000,
  timezone: text(process.env.TZ) || 'Europe/Moscow',
  databaseUrl: text(process.env.DATABASE_URL),
  sessionSecret: text(process.env.SESSION_SECRET),
  admin: {
    username: text(process.env.ADMIN_USERNAME),
    passwordHash: text(process.env.ADMIN_PASSWORD_HASH),
    password: text(process.env.ADMIN_PASSWORD),
  },
  telegram: {
    token: text(process.env.TELEGRAM_BOT_TOKEN),
    chatId: text(process.env.TELEGRAM_CHAT_ID),
    webhookUrl: text(process.env.WEBHOOK_URL).replace(/\/+$/, ''),
    webhookSecret: text(process.env.TELEGRAM_WEBHOOK_SECRET),
  },
  paths: {
    views: path.join(__dirname, '..', 'views'),
    public: path.join(__dirname, '..', 'public'),
  },
  adminConfigured: false,
};

config.adminConfigured = Boolean(config.admin.username && (config.admin.passwordHash || config.admin.password));

function describeDatabase(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return 'не удалось разобрать DATABASE_URL';
  }
}

function assertConfig() {
  const errors = [];

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL не задан. Строка подключения берётся в Neon: Project → Connect → Connection string.');
  } else if (!/^postgres(ql)?:\/\//i.test(config.databaseUrl)) {
    errors.push('DATABASE_URL должен начинаться с postgresql:// — это строка подключения Neon, а не пароль.');
  }

  if (!config.sessionSecret) {
    errors.push('SESSION_SECRET не задан. Сгенерируйте: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  } else if (config.sessionSecret.length < 16) {
    errors.push('SESSION_SECRET слишком короткий: нужно минимум 16 символов.');
  }

  if (errors.length > 0) {
    console.error('\n[конфигурация] Запуск невозможен:');
    for (const error of errors) console.error(`  • ${error}`);
    console.error('\nЛокально: скопируйте .env.example в .env и заполните значения.');
    console.error('На Render: Dashboard → ваш сервис → Environment → добавьте переменные.\n');
    process.exit(1);
  }

  if (!config.adminConfigured) {
    console.warn('[конфигурация] ADMIN_USERNAME/ADMIN_PASSWORD_HASH не заданы — вход в админку отключён.');
  } else if (config.isProduction && !config.admin.passwordHash) {
    console.warn('[конфигурация] На проде используйте ADMIN_PASSWORD_HASH вместо ADMIN_PASSWORD.');
  }

  if (!config.telegram.token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN не задан — бот отключён, уведомления не отправляются.');
  } else {
    if (!config.telegram.chatId) {
      console.warn('[telegram] TELEGRAM_CHAT_ID не задан — результаты не будут приходить в чат.');
    }
    if (!config.telegram.webhookUrl) {
      console.warn('[telegram] WEBHOOK_URL не задан — webhook не будет установлен автоматически.');
    }
    if (!config.telegram.webhookSecret) {
      console.warn('[telegram] TELEGRAM_WEBHOOK_SECRET не задан — webhook не принимает запросы (это обязательно).');
    } else if (!/^[A-Za-z0-9_-]{1,256}$/.test(config.telegram.webhookSecret)) {
      console.warn('[telegram] TELEGRAM_WEBHOOK_SECRET содержит недопустимые символы: Telegram разрешает только A-Z, a-z, 0-9, _ и -.');
    }
  }

  console.log(`[конфигурация] окружение: ${config.nodeEnv}, база: ${describeDatabase(config.databaseUrl)}, часовой пояс: ${config.timezone}`);
}

module.exports = config;
module.exports.assertConfig = assertConfig;
module.exports.describeDatabase = describeDatabase;
