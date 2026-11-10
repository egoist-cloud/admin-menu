'use strict';

require('dotenv').config();

const path = require('node:path');

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Значения в Render часто копируют вместе с кавычками или целиком строкой
// ADMIN_PASSWORD_HASH=... — снимаем это, чтобы вход не ломался из-за формата.
function unquote(value) {
  let result = text(value);
  if (result.length >= 2) {
    const first = result[0];
    const last = result[result.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      result = result.slice(1, -1).trim();
    }
  }
  return result;
}

function cleanEnv(value) {
  return unquote(unquote(value).replace(/^[A-Z0-9_]+\s*=\s*/, ''));
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
  sessionSecret: unquote(process.env.SESSION_SECRET),
  admin: {
    username: cleanEnv(process.env.ADMIN_USERNAME),
    passwordHash: cleanEnv(process.env.ADMIN_PASSWORD_HASH),
    password: unquote(process.env.ADMIN_PASSWORD),
  },
  telegram: {
    token: text(process.env.TELEGRAM_BOT_TOKEN),
    chatId: text(process.env.TELEGRAM_CHAT_ID),
    webhookUrl: text(process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, ''),
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

  if (config.admin.passwordHash && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(config.admin.passwordHash)) {
    console.warn('[конфигурация] ADMIN_PASSWORD_HASH не похож на bcrypt-хеш (ожидается $2b$12$...). Сгенерируйте: npm run hash -- "ваш-пароль"');
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
      console.warn('[telegram] TELEGRAM_WEBHOOK_SECRET не задан — сгенерирую случайный при старте, webhook всё равно защищён.');
    } else if (!/^[A-Za-z0-9_-]{1,256}$/.test(config.telegram.webhookSecret)) {
      console.warn('[telegram] TELEGRAM_WEBHOOK_SECRET содержит недопустимые символы — будет заменён сгенерированным.');
    }
  }

  console.log(`[конфигурация] окружение: ${config.nodeEnv}, база: ${describeDatabase(config.databaseUrl)}, часовой пояс: ${config.timezone}`);
}

module.exports = config;
module.exports.assertConfig = assertConfig;
module.exports.describeDatabase = describeDatabase;
