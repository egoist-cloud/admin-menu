'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const express = require('express');

const { formatDateTime } = require('../src/lib/format');
const { buildPlayerHistory, normalizePlayerName } = require('../src/lib/player-history');
const { createPlayerHistoryHandler } = require('../src/routes/player-history');

function submission(id, participantName, score, totalQuestions, createdAt) {
  return {
    id,
    participantName,
    score,
    totalQuestions,
    createdAt: new Date(createdAt),
    test: { title: 'Основы CS2' },
  };
}

async function withServer(prisma, callback) {
  const app = express();
  app.get('/admin/players/history', createPlayerHistoryHandler(prisma));

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('normalizePlayerName схлопывает пробелы и ограничивает длину', () => {
  assert.equal(normalizePlayerName('  s1mple   '), 's1mple');
  assert.equal(normalizePlayerName('s1mple\t \n NiKo'), 's1mple NiKo');
  assert.equal(normalizePlayerName('x'.repeat(100)).length, 80);
});

test('buildPlayerHistory считает средний и лучший результат', () => {
  const rows = [
    submission(1, 's1mple', 3, 5, '2026-11-10T10:00:00.000Z'),
    submission(2, 'S1MPLE', 5, 5, '2026-11-12T10:00:00.000Z'),
    submission(3, ' s1mple ', 4, 5, '2026-11-11T10:00:00.000Z'),
  ];

  const history = buildPlayerHistory(rows, 's1mple');

  assert.equal(history.total, 3);
  assert.equal(history.average, 80);
  assert.equal(history.best, 100);
  assert.equal(history.name, 'S1MPLE');
  assert.equal(history.lastAt, formatDateTime(rows[1].createdAt));
  assert.deepEqual(
    history.submissions.map((item) => item.id),
    [2, 3, 1],
  );
});

test('buildPlayerHistory группирует имя без учёта регистра и пробелов, но не по частичному совпадению', () => {
  const rows = [
    submission(1, 's1mple', 5, 5, '2026-11-12T10:00:00.000Z'),
    submission(2, 'S1MPLE', 4, 5, '2026-11-11T10:00:00.000Z'),
    submission(3, 'NiKo', 5, 5, '2026-11-10T10:00:00.000Z'),
    submission(4, 's1mple fan', 5, 5, '2026-11-09T10:00:00.000Z'),
  ];

  assert.equal(buildPlayerHistory(rows, 'S1MPLE').total, 2);
  assert.equal(buildPlayerHistory(rows, 's1m'), null);
  assert.equal(buildPlayerHistory(rows, 's1mple fan').total, 1);
});

test('история игрока отдаёт 200, средний и лучший результат по HTTP', async () => {
  const rows = [
    submission(1, 's1mple', 3, 5, '2026-11-10T10:00:00.000Z'),
    submission(2, 'S1MPLE', 5, 5, '2026-11-12T10:00:00.000Z'),
  ];
  let receivedWhere;

  const prisma = {
    submission: {
      findMany: async ({ where }) => {
        receivedWhere = where;
        return rows;
      },
    },
  };

  await withServer(prisma, async (base) => {
    const response = await fetch(`${base}/admin/players/history?name=%20s1mple%20`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(receivedWhere, {
      participantName: { equals: 's1mple', mode: 'insensitive' },
    });
    assert.equal(body.total, 2);
    assert.equal(body.average, 80);
    assert.equal(body.best, 100);
  });
});

test('неизвестный игрок получает 404', async () => {
  const prisma = {
    submission: {
      findMany: async () => [],
    },
  };

  await withServer(prisma, async (base) => {
    const response = await fetch(`${base}/admin/players/history?name=ghost`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, { error: 'История не найдена.' });
  });
});

test('пустое имя получает 400', async () => {
  const prisma = {
    submission: {
      findMany: async () => {
        throw new Error('Запрос к базе не должен выполняться');
      },
    },
  };

  await withServer(prisma, async (base) => {
    const response = await fetch(`${base}/admin/players/history?name=%20%20`);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Не указано имя игрока.' });
  });
});
