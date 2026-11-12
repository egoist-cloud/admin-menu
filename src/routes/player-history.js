'use strict';

const { normalizePlayerName, buildPlayerHistory } = require('../lib/player-history');

function createPlayerHistoryHandler(prisma) {
  return async function playerHistoryHandler(req, res) {
    const name = normalizePlayerName(req.query.name);

    if (!name) return res.status(400).json({ error: 'Не указано имя игрока.' });

    const submissions = await prisma.submission.findMany({
      where: { participantName: { equals: name, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      include: { test: { select: { title: true } } },
    });

    const history = buildPlayerHistory(submissions, name);
    if (!history) return res.status(404).json({ error: 'История не найдена.' });

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json(history);
  };
}

module.exports = { createPlayerHistoryHandler };
