'use strict';

const express = require('express');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const { prisma } = require('../prisma');
const { asyncHandler } = require('../lib/async-handler');
const { formatDateTime, formatPercent } = require('../lib/format');
const { parseTestForm } = require('../lib/test-payload');
const { requireAdmin, verifyCredentials } = require('../middleware/auth');
const { notifyNewSubmission, sendTestMessage, getTelegramStatus } = require('../lib/telegram');
const { ensureCsrfToken, csrfProtection, sameOriginOnly } = require('../middleware/csrf');

const router = express.Router();
const PAGE_SIZE = 25;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      title: 'Слишком много попыток',
      status: 429,
      message: 'Слишком много попыток входа. Подождите 15 минут.',
    });
  },
});

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safeAdminPath(value) {
  return typeof value === 'string' && value.startsWith('/admin') ? value : '/admin/tests';
}

function setFlash(req, type, text) {
  req.session.flash = { type, text };
}

function renderNotFound(res) {
  return res.status(404).render('error', {
    title: 'Не найдено',
    status: 404,
    message: 'Страница или запись не найдены.',
  });
}

function renderTestForm(res, { test, form, errors, status = 200 }) {
  return res.status(status).render('admin/test-form', {
    title: test ? 'Редактирование теста' : 'Новый тест',
    test,
    form,
    errors,
    initialQuestions: JSON.stringify(form.questions || []),
  });
}

function toFormQuestions(test) {
  return test.questions.map((question) => ({
    text: question.text,
    image: question.imageData || null,
    multiple: question.multiple,
    options: question.options.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
  }));
}

function loadTestWithQuestions(id) {
  return prisma.test.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { options: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
      },
    },
  });
}

function questionCreateData(questions) {
  return questions.map((question, index) => ({
    text: question.text,
    imageData: question.image,
    multiple: question.multiple,
    position: index,
    options: {
      create: question.options.map((option, optionIndex) => ({
        text: option.text,
        isCorrect: option.isCorrect,
        position: optionIndex,
      })),
    },
  }));
}

// CSRF-токен для всех страниц админки (включая форму входа)
router.use((req, res, next) => {
  res.locals.csrfToken = ensureCsrfToken(req);
  next();
});

router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/tests');

  res.render('admin/login', {
    title: 'Вход в админ-панель',
    error: null,
    username: '',
    nextTarget: safeAdminPath(req.query.next),
    adminConfigured: config.adminConfigured,
  });
});

router.post(
  '/login',
  loginLimiter,
  sameOriginOnly,
  csrfProtection,
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const nextTarget = safeAdminPath(req.body.next);
    const success = await verifyCredentials(username, password);

    if (!success) {
      return res.status(401).render('admin/login', {
        title: 'Вход в админ-панель',
        error: config.adminConfigured
          ? 'Неверный логин или пароль.'
          : 'Вход не настроен: задайте ADMIN_USERNAME и ADMIN_PASSWORD_HASH в переменных окружения.',
        username,
        nextTarget,
        adminConfigured: config.adminConfigured,
      });
    }

    return req.session.regenerate((error) => {
      if (error) {
        console.error('[admin] не удалось создать сессию:', error);
        return res.status(500).render('error', {
          title: 'Ошибка входа',
          status: 500,
          message: 'Не удалось создать сессию. Попробуйте ещё раз.',
        });
      }

      req.session.isAdmin = true;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      req.session.flash = { type: 'success', text: 'Вы вошли в админ-панель.' };
      return res.redirect(nextTarget);
    });
  }),
);

router.post('/logout', csrfProtection, (req, res) => {
  req.session.destroy((error) => {
    if (error) console.error('[admin] ошибка выхода:', error);
    res.redirect('/');
  });
});

router.use(requireAdmin);

router.get('/', (req, res) => {
  res.redirect('/admin/tests');
});

router.get(
  '/tests',
  asyncHandler(async (req, res) => {
    const tests = await prisma.test.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true, submissions: true } } },
    });

    res.render('admin/tests', { title: 'Тесты', tests });
  }),
);

router.get('/tests/new', (req, res) => {
  renderTestForm(res, {
    test: null,
    form: { title: '', description: '', questions: [] },
    errors: [],
  });
});

router.get(
  '/tests/:id/edit',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return renderNotFound(res);

    const test = await loadTestWithQuestions(id);
    if (!test) return renderNotFound(res);

    return renderTestForm(res, {
      test,
      form: { title: test.title, description: test.description, questions: toFormQuestions(test) },
      errors: [],
    });
  }),
);

router.post(
  '/tests',
  csrfProtection,
  asyncHandler(async (req, res) => {
    const parsed = parseTestForm(req.body);
    const publish = req.body.action === 'publish';

    if (parsed.errors.length > 0) {
      return renderTestForm(res, { test: null, form: parsed, errors: parsed.errors, status: 422 });
    }

    const test = await prisma.test.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        isPublished: publish,
        questions: { create: questionCreateData(parsed.questions) },
      },
    });

    setFlash(
      req,
      'success',
      publish ? `Тест «${test.title}» создан и опубликован.` : `Тест «${test.title}» сохранён как черновик.`,
    );
    return res.redirect('/admin/tests');
  }),
);

router.post(
  '/tests/:id',
  csrfProtection,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return renderNotFound(res);

    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) return renderNotFound(res);

    const parsed = parseTestForm(req.body);
    const publish = req.body.action === 'publish';

    if (parsed.errors.length > 0) {
      const test = await loadTestWithQuestions(id);
      return renderTestForm(res, { test, form: parsed, errors: parsed.errors, status: 422 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: { id },
        data: {
          title: parsed.title,
          description: parsed.description,
          ...(publish ? { isPublished: true } : {}),
        },
      });

      // Вопросы пересоздаются целиком: у сохранённых ответов остаются текстовые снимки,
      // поэтому старые результаты в админке читаются корректно.
      await tx.question.deleteMany({ where: { testId: id } });

      for (const [index, question] of parsed.questions.entries()) {
        await tx.question.create({
          data: {
            testId: id,
            text: question.text,
            imageData: question.image,
            multiple: question.multiple,
            position: index,
            options: {
              create: question.options.map((option, index) => ({
                text: option.text,
                isCorrect: option.isCorrect,
                position: index,
              })),
            },
          },
        });
      }
    });

    setFlash(req, 'success', `Тест «${parsed.title}» сохранён.`);
    return res.redirect('/admin/tests');
  }),
);

router.post(
  '/tests/:id/publish',
  csrfProtection,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return renderNotFound(res);

    const published = req.body.published === '1';
    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) return renderNotFound(res);

    await prisma.test.update({ where: { id }, data: { isPublished: published } });

    setFlash(
      req,
      'success',
      published ? `Тест «${existing.title}» опубликован.` : `Тест «${existing.title}» снят с публикации.`,
    );
    return res.redirect('/admin/tests');
  }),
);

router.post(
  '/tests/:id/delete',
  csrfProtection,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return renderNotFound(res);

    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) return renderNotFound(res);

    await prisma.test.delete({ where: { id } });
    setFlash(req, 'success', `Тест «${existing.title}» удалён вместе с результатами.`);
    return res.redirect('/admin/tests');
  }),
);

router.get('/telegram', (req, res) => {
  res.render('admin/telegram', { title: 'Telegram', status: getTelegramStatus() });
});

router.post(
  '/telegram/test',
  csrfProtection,
  asyncHandler(async (req, res) => {
    try {
      await sendTestMessage();
      setFlash(req, 'success', 'Тестовое сообщение отправлено в Telegram.');
    } catch (error) {
      setFlash(req, 'error', `Telegram не принял сообщение: ${error.message}`);
    }
    res.redirect('/admin/telegram');
  }),
);

router.post(
  '/results/:id/notify',
  csrfProtection,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return renderNotFound(res);

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { test: { select: { title: true } } },
    });
    if (!submission) return renderNotFound(res);

    try {
      await notifyNewSubmission({
        participantName: submission.participantName,
        testTitle: submission.test.title,
        score: submission.score,
        totalQuestions: submission.totalQuestions,
        createdAt: submission.createdAt,
      });
      setFlash(req, 'success', `Результат #${submission.id} отправлен в Telegram.`);
    } catch (error) {
      setFlash(req, 'error', `Telegram не принял сообщение: ${error.message}`);
    }

    return res.redirect(`/admin/results/${submission.id}`);
  }),
);

router.get(
  '/players/history',
  asyncHandler(async (req, res) => {
    const name = String(req.query.name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);

    if (!name) return res.status(400).json({ error: 'Не указано имя игрока.' });

    const submissions = await prisma.submission.findMany({
      where: { participantName: { equals: name, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      include: { test: { select: { title: true } } },
    });

    if (submissions.length === 0) return res.status(404).json({ error: 'История не найдена.' });

    const percentages = submissions.map((submission) =>
      submission.totalQuestions > 0 ? Math.round((submission.score / submission.totalQuestions) * 100) : 0,
    );

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      name: submissions[0].participantName,
      total: submissions.length,
      average: Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length),
      best: Math.max(...percentages),
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
  }),
);

router.get(
  '/results',
  asyncHandler(async (req, res) => {
    const testId = parseId(req.query.testId);
    const searchName = String(req.query.name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const requestedPage = Number.parseInt(req.query.page, 10);
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const where = {
      ...(testId ? { testId } : {}),
      ...(searchName ? { participantName: { contains: searchName, mode: 'insensitive' } } : {}),
    };

    const total = await prisma.submission.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const [submissions, tests] = await Promise.all([
      prisma.submission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { test: { select: { title: true } } },
      }),
      prisma.test.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    ]);

    res.render('admin/results', {
      title: 'Результаты',
      submissions,
      tests,
      selectedTestId: testId,
      searchName,
      page: currentPage,
      totalPages,
      total,
    });
  }),
);

router.get(
  '/results/export.csv',
  asyncHandler(async (req, res) => {
    const testId = parseId(req.query.testId);
    const searchName = String(req.query.name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const where = {
      ...(testId ? { testId } : {}),
      ...(searchName ? { participantName: { contains: searchName, mode: 'insensitive' } } : {}),
    };

    const submissions = await prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        test: { select: { title: true } },
        answers: { orderBy: { id: 'asc' } },
      },
    });

    const header = ['ID', 'Имя', 'Тест', 'Дата и время', 'Правильных', 'Всего вопросов', 'Процент', 'Ответы'];
    const lines = [header.map(csvCell).join(';')];

    for (const submission of submissions) {
      const details = submission.answers
        .map((answer) => `${answer.questionText} → ${answer.answerText} (${answer.isCorrect ? 'верно' : 'неверно'})`)
        .join(' | ');

      lines.push(
        [
          submission.id,
          submission.participantName,
          submission.test.title,
          formatDateTime(submission.createdAt),
          submission.score,
          submission.totalQuestions,
          formatPercent(submission.score, submission.totalQuestions),
          details,
        ]
          .map(csvCell)
          .join(';'),
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
    res.send(`\uFEFF${lines.join('\r\n')}`);
  }),
);

router.get(
  '/results/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return renderNotFound(res);

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        test: { select: { id: true, title: true } },
        answers: { orderBy: { id: 'asc' } },
      },
    });

    if (!submission) return renderNotFound(res);

    const groups = [];
    const seen = new Map();

    for (const answer of submission.answers) {
      const key = `${answer.questionId === null ? 'snapshot' : answer.questionId}:${answer.questionText}`;
      if (!seen.has(key)) {
        const group = { questionText: answer.questionText, isCorrect: answer.isCorrect, answers: [] };
        seen.set(key, group);
        groups.push(group);
      }
      seen.get(key).answers.push(answer.answerText);
    }

    return res.render('admin/result-detail', {
      title: `Результат #${submission.id}`,
      submission,
      groups,
    });
  }),
);

function csvCell(value) {
  let text = String(value ?? '');
  // Защита от формул в Excel/Sheets
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

module.exports = router;
