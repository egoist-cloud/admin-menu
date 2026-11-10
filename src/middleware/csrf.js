'use strict';

const crypto = require('node:crypto');

function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function csrfProtection(req, res, next) {
  const token = req.body && typeof req.body._csrf === 'string' ? req.body._csrf : '';
  const expected = req.session && typeof req.session.csrfToken === 'string' ? req.session.csrfToken : '';

  const valid =
    token.length > 0 &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

  if (!valid) {
    return res.status(403).render('error', {
      title: 'Форма устарела',
      status: 403,
      message: 'Сессия истекла или страница устарела. Обновите страницу и попробуйте снова.',
    });
  }

  return next();
}

function sameOriginOnly(req, res, next) {
  const origin = req.get('origin');
  // "null" присылают sandbox-iframe и другие opaque-контексты. Для админки
  // всё равно обязателен CSRF-токен, а публичная отправка ограничена rate limit.
  if (!origin || origin === 'null') return next();

  try {
    const parsed = new URL(origin);
    if (parsed.host !== req.get('host')) {
      console.warn(`[csrf] отклонён запрос: origin=${origin}, host=${req.get('host')}, url=${req.originalUrl}`);
      return res.status(403).render('error', {
        title: 'Запрос отклонён',
        status: 403,
        message: 'Запрос пришёл с чужого сайта.',
      });
    }
  } catch {
    console.warn(`[csrf] некорректный Origin: ${origin}, host=${req.get('host')}, url=${req.originalUrl}`);
    return res.status(403).render('error', {
      title: 'Запрос отклонён',
      status: 403,
      message: 'Некорректный источник запроса.',
    });
  }

  return next();
}

module.exports = { ensureCsrfToken, csrfProtection, sameOriginOnly };
