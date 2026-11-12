'use strict';

const crypto = require('node:crypto');
const express = require('express');

const config = require('../config');
const { prisma } = require('../prisma');
const { asyncHandler } = require('../lib/async-handler');
const { normalizePlayerName } = require('../lib/player-history');
const { ROLES } = require('../lib/roles');

const router = express.Router();
const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

function cleanName(value) {
  const name = normalizePlayerName(value);
  return name.length >= 2 && name.length <= 40 ? name : '';
}

function steamReturnUrl(state) {
  const url = new URL('/auth/steam/return', config.publicUrl);
  url.searchParams.set('state', state);
  return url;
}

function fail(res, message) {
  console.warn(`[auth] Steam: ${message}`);
  return res.redirect('/confusa?error=steam');
}

router.get('/steam', (req, res) => {
  const state = crypto.randomBytes(24).toString('hex');
  req.session.steamState = state;
  req.session.steamName = cleanName(req.query.name);

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': steamReturnUrl(state).toString(),
    'openid.realm': config.publicUrl,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return res.redirect(`${STEAM_OPENID}?${params.toString()}`);
});

router.get(
  '/steam/return',
  asyncHandler(async (req, res) => {
    const expectedState = req.session && req.session.steamState;
    const pendingName = req.session && req.session.steamName;
    if (req.session) {
      delete req.session.steamState;
      delete req.session.steamName;
    }

    if (!expectedState || req.query.state !== expectedState) {
      return fail(res, 'state не совпал');
    }

    if (req.query['openid.mode'] !== 'id_res') {
      return fail(res, 'Steam не подтвердил вход');
    }

    const verification = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (!key.startsWith('openid.')) continue;
      if (Array.isArray(value)) value.forEach((item) => verification.append(key, String(item)));
      else if (typeof value === 'string') verification.append(key, value);
    }
    verification.set('openid.mode', 'check_authentication');

    let isValid = false;
    try {
      const response = await fetch(STEAM_OPENID, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verification.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await response.text();
      isValid = /^is_valid:true$/m.test(text);
    } catch (error) {
      console.error('[auth] Steam verification failed:', error.message);
    }

    if (!isValid) return fail(res, 'проверка подписи не прошла');

    const claimedId = String(req.query['openid.claimed_id'] || '');
    const match = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId);
    if (!match) return fail(res, 'некорректный SteamID');

    const steamId = match[1];

    try {
      let isNew = false;
      let user = await prisma.user.findUnique({ where: { steamId } });

      if (user) {
        user = await prisma.user.update({
          where: { steamId },
          data: { lastLoginAt: new Date() },
        });
      } else {
        isNew = true;
        user = await prisma.user.create({
          data: {
            steamId,
            displayName: pendingName || `Игрок ${steamId.slice(-4)}`,
            role: ROLES.PLAYER,
            lastLoginAt: new Date(),
          },
        });
      }

      return req.session.regenerate((error) => {
        if (error) {
          console.error('[auth] не удалось создать сессию Steam:', error);
          return res.redirect('/confusa?error=steam');
        }

        req.session.userId = user.id;
        req.session.isAdmin = false;
        req.session.flash = {
          type: 'success',
          text: isNew
            ? 'Steam подключён. Добро пожаловать в Confusa.'
            : 'Вы вошли через Steam.',
        };
        return res.redirect('/confusa');
      });
    } catch (error) {
      console.error('[auth] не удалось сохранить пользователя Steam:', error.message);
      return fail(res, 'ошибка базы данных');
    }
  }),
);

module.exports = router;
