'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');

function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  if (bufferA.length !== bufferB.length) {
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

async function verifyCredentials(username, password) {
  if (!config.adminConfigured) return false;

  const submittedUser = String(username || '').trim();
  const submittedPassword = String(password || '');
  if (!submittedUser || !submittedPassword) return false;

  const userMatches = safeEqual(submittedUser, config.admin.username);

  if (config.admin.passwordHash) {
    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(submittedPassword, config.admin.passwordHash);
    } catch {
      passwordMatches = false;
    }
    return userMatches && passwordMatches;
  }

  const passwordMatches = safeEqual(submittedPassword, config.admin.password);
  return userMatches && passwordMatches;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();

  if (req.method === 'GET') {
    const target = req.originalUrl && req.originalUrl.startsWith('/admin') ? req.originalUrl : '/admin/tests';
    return res.redirect(`/admin/login?next=${encodeURIComponent(target)}`);
  }

  return res.status(401).render('error', {
    title: 'Требуется вход',
    status: 401,
    message: 'Нужно войти в админ-панель.',
  });
}

module.exports = { verifyCredentials, requireAdmin };
