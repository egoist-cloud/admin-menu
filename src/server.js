'use strict';

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const PgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const config = require('./config');
const { assertConfig } = require('./config');
const { prisma } = require('./prisma');
const { initTelegram, setupTelegramWebhook } = require('./lib/telegram');
const { formatDateTime, formatPercent, plural } = require('./lib/format');
const { ensureCsrfToken } = require('./middleware/csrf');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const telegramRoutes = require('./routes/telegram');

assertConfig();

const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', config.paths.views);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'upgrade-insecure-requests': config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(express.urlencoded({ extended: false, limit: '128kb' }));
app.use(express.json({ limit: '256kb' }));
app.use(
  express.static(config.paths.public, {
    maxAge: config.isProduction ? '1h' : 0,
    etag: true,
  }),
);

function sslConfig(connectionString) {
  if (/sslmode=(require|verify-ca|verify-full)/i.test(connectionString)) return undefined;
  if (/@(localhost|127\.0\.0\.1)[:/]/i.test(connectionString)) return false;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: sslConfig(config.databaseUrl),
});

pool.on('error', (error) => {
  console.error('[pg] ошибка пула соединений:', error.message);
});

app.use(
  session({
    name: 'admin_menu_sid',
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: false,
      pruneSessionInterval: 60 * 60,
      errorLog: (error) => console.error('[session] ошибка хранилища сессий:', error.message),
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: 12 * 60 * 60 * 1000,
    },
  }),
);

app.use((req, res, next) => {
  res.locals.appName = 'Admin Menu';
  res.locals.currentYear = new Date().getFullYear();
  res.locals.path = req.path;
  res.locals.isAdmin = Boolean(req.session && req.session.isAdmin);
  res.locals.csrfToken = req.session && req.session.isAdmin ? ensureCsrfToken(req) : '';
  res.locals.flash = req.session && req.session.flash ? req.session.flash : null;
  if (req.session && req.session.flash) delete req.session.flash;
  res.locals.formatDateTime = formatDateTime;
  res.locals.formatPercent = formatPercent;
  res.locals.plural = plural;
  next();
});

app.get('/healthz', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[healthz] база недоступна:', error.message);
    res.status(500).json({ status: 'error' });
  }
});

app.use(telegramRoutes);
app.use('/admin', adminRoutes);
app.use(publicRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Страница не найдена',
    status: 404,
    message: 'Такой страницы нет. Проверьте адрес или вернитесь на главную.',
  });
});

// Ошибки
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[server] ошибка:', error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  return res.status(status).render('error', {
    title: 'Ошибка сервера',
    status,
    message:
      status === 500
        ? 'Внутренняя ошибка сервера. Если повторяется — посмотрите логи на Render.'
        : 'Запрос не удалось обработать.',
  });
});

async function start() {
  initTelegram();

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] слушаю http://0.0.0.0:${config.port} (${config.nodeEnv})`);
  });

  setupTelegramWebhook().catch((error) => {
    console.error('[telegram] ошибка настройки webhook:', error);
  });

  const shutdown = (signal) => {
    console.log(`[server] получен ${signal}, завершаю работу...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error('[prisma] ошибка отключения:', error.message);
      }
      try {
        await pool.end();
      } catch (error) {
        console.error('[pg] ошибка закрытия пула:', error.message);
      }
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('[server] не удалось запуститься:', error);
  process.exit(1);
});
