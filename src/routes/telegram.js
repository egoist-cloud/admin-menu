'use strict';

const express = require('express');
const config = require('../config');
const { getWebhookHandler } = require('../lib/telegram');

const router = express.Router();

router.post('/api/telegram/webhook', (req, res, next) => {
  if (!config.telegram.token || !config.telegram.webhookSecret) {
    return res.status(503).json({ ok: false, error: 'telegram bot is not configured' });
  }

  const handler = getWebhookHandler();
  if (!handler) {
    return res.status(503).json({ ok: false, error: 'telegram webhook is not ready' });
  }

  return handler(req, res, next);
});

module.exports = router;
