'use strict';

const express = require('express');
const nodePath = require('node:path');

const { formatDateTime, formatPercent, plural } = require('../src/lib/format');
const { TESTS, SUBMISSIONS } = require('./data');

const app = express();
const PORT = Number.parseInt(process.env.DEMO_PORT || '3100', 10);
const views = nodePath.join(__dirname, '..', 'views');
const publicDir = nodePath.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', views);
app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

function baseLocals(req, extra = {}) {
  return {
    path: req.path,
    isAdmin: true,
    csrfToken: 'demo-csrf-token',
    currentYear: new Date().getFullYear(),
    flash: null,
    plural,
    formatDateTime,
    formatPercent,
    ...extra,
  };
}

function findTest(id) {
  return TESTS.find((test) => test.id === Number(id));
}

function findSubmission(id) {
  return SUBMISSIONS.find((submission) => submission.id === Number(id));
}

function filteredSubmissions(query) {
  const testId = Number.parseInt(query.testId, 10);
  const searchName = String(query.name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .toLowerCase();

  return SUBMISSIONS.filter((submission) => {
    if (Number.isInteger(testId) && testId > 0 && submission.testId !== testId) return false;
    if (searchName && !submission.participantName.toLowerCase().includes(searchName)) return false;
    return true;
  });
}

app.get('/', (req, res) => {
  res.render(
    'index',
    baseLocals(req, {
      title: 'Онлайн-тесты',
      tests: TESTS,
      flash: {
        type: 'success',
        text: 'Локальное демо: тестовые данные, production-база не используется.',
      },
    }),
  );
});

app.get('/tests/:id', (req, res) => {
  const test = findTest(req.params.id);
  if (!test) return res.status(404).render('error', baseLocals(req, {
    title: 'Не найдено',
    status: 404,
    message: 'В демо такого теста нет.',
  }));

  return res.render(
    'test',
    baseLocals(req, {
      title: test.title,
      test,
      errors: [],
      participantName: '',
    }),
  );
});

app.post('/tests/:id/submit', (req, res) => {
  const test = findTest(req.params.id);
  if (!test) return res.redirect('/');

  let score = 0;
  for (const current of test.questions) {
    const raw = req.body['q_' + current.id];
    const selected = (Array.isArray(raw) ? raw : [raw])
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => a - b);
    const correct = current.options
      .filter((item) => item.isCorrect)
      .map((item) => item.id)
      .sort((a, b) => a - b);

    if (selected.length === correct.length && selected.every((id, index) => id === correct[index])) {
      score += 1;
    }
  }

  const participantName =
    String(req.body.participantName || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Гость';

  SUBMISSIONS.unshift({
    id: Math.max(...SUBMISSIONS.map((submission) => submission.id)) + 1,
    testId: test.id,
    participantName,
    score,
    totalQuestions: test.questions.length,
    createdAt: new Date(),
    test: { title: test.title },
  });

  return res.redirect('/thanks');
});

app.get('/thanks', (req, res) => {
  res.render('thanks', baseLocals(req, { title: 'Спасибо' }));
});

app.get('/admin/tests', (req, res) => {
  res.redirect('/admin/results');
});

app.get('/admin/tests/new', (req, res) => {
  res.redirect('/admin/results');
});

app.get('/admin/tests/:id/edit', (req, res) => {
  res.redirect('/admin/results');
});

app.get('/admin/results', (req, res) => {
  const submissions = filteredSubmissions(req.query);
  const testId = Number.parseInt(req.query.testId, 10);

  res.render(
    'admin/results',
    baseLocals(req, {
      title: 'Результаты',
      submissions,
      tests: TESTS,
      selectedTestId: Number.isInteger(testId) && testId > 0 ? testId : null,
      searchName: String(req.query.name || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      page: 1,
      totalPages: 1,
      total: submissions.length,
      flash: {
        type: 'success',
        text: 'Локальное демо: нажмите на имя игрока, чтобы открыть историю.',
      },
    }),
  );
});

app.get('/admin/players/history', (req, res) => {
  const name = String(req.query.name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  if (!name) return res.status(400).json({ error: 'Не указано имя игрока.' });

  const submissions = SUBMISSIONS.filter(
    (submission) => submission.participantName.toLowerCase() === name.toLowerCase(),
  ).sort((a, b) => b.createdAt - a.createdAt);

  if (submissions.length === 0) {
    return res.status(404).json({ error: 'История не найдена.' });
  }

  const percentages = submissions.map((submission) =>
    submission.totalQuestions > 0
      ? Math.round((submission.score / submission.totalQuestions) * 100)
      : 0,
  );

  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({
    name: submissions[0].participantName,
    total: submissions.length,
    average: Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length),
    best: percentages.reduce((max, value) => Math.max(max, value), 0),
    lastAt: formatDateTime(submissions[0].createdAt),
    submissions: submissions.map((submission) => ({
      id: submission.id,
      testTitle: submission.test.title,
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      percent:
        submission.totalQuestions > 0
          ? Math.round((submission.score / submission.totalQuestions) * 100)
          : 0,
      date: formatDateTime(submission.createdAt),
    })),
  });
});

app.get('/admin/results/export.csv', (req, res) => {
  const submissions = filteredSubmissions(req.query);
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['ID', 'Имя', 'Тест', 'Дата и время', 'Правильных', 'Всего вопросов', 'Процент']
      .map(escape)
      .join(';'),
    ...submissions.map((submission) =>
      [
        submission.id,
        submission.participantName,
        submission.test.title,
        formatDateTime(submission.createdAt),
        submission.score,
        submission.totalQuestions,
        formatPercent(submission.score, submission.totalQuestions),
      ]
        .map(escape)
        .join(';'),
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="demo-results.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

app.get('/admin/results/:id', (req, res) => {
  const submission = findSubmission(req.params.id);
  if (!submission) {
    return res.status(404).render('error', baseLocals(req, {
      title: 'Не найдено',
      status: 404,
      message: 'В демо такого результата нет.',
    }));
  }

  const test = findTest(submission.testId);
  const groups = test.questions.map((current, index) => ({
    questionText: current.text,
    isCorrect: index < submission.score,
    answers: [current.options[index < submission.score ? 1 : 0].text],
  }));

  return res.render(
    'admin/result-detail',
    baseLocals(req, {
      title: `Результат #${submission.id}`,
      submission,
      groups,
    }),
  );
});

app.post('/admin/logout', (req, res) => {
  res.redirect('/');
});

app.get('/admin/telegram', (req, res) => {
  res.redirect('/admin/results');
});

app.use((req, res) => {
  res.status(404).render('error', baseLocals(req, {
    title: 'Не найдено',
    status: 404,
    message: 'В локальном демо такой страницы нет.',
  }));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[demo] http://127.0.0.1:${PORT}`);
  console.log(`[demo] тестов: ${TESTS.length}, прохождений: ${SUBMISSIONS.length}`);
});
