'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

const { prisma } = require('../prisma');
const { asyncHandler } = require('../lib/async-handler');
const { evaluateSubmission } = require('../lib/scoring');
const { notifyNewSubmission } = require('../lib/telegram');
const { sameOriginOnly } = require('../middleware/csrf');

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      title: 'Слишком много попыток',
      status: 429,
      message: 'Слишком много отправок. Подождите 10 минут и попробуйте снова.',
    });
  },
});

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function findPublishedTest(id) {
  return prisma.test.findFirst({
    where: { id, isPublished: true },
    include: {
      questions: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { options: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } },
      },
    },
  });
}

function notFound(res, message) {
  return res.status(404).render('error', {
    title: 'Тест не найден',
    status: 404,
    message: message || 'Такого теста нет или он ещё не опубликован.',
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tests = await prisma.test.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true, submissions: true } } },
    });

    res.render('index', { title: 'Проверка готовности', tests });
  }),
);

router.get(
  '/tests/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);

    const test = await findPublishedTest(id);
    if (!test) return notFound(res);
    if (test.questions.length === 0) {
      return notFound(res, 'В этом тесте пока нет вопросов. Загляните позже.');
    }

    return res.render('test', {
      title: test.title,
      test,
      errors: [],
      participantName: req.currentUser ? req.currentUser.displayName : '',
    });
  }),
);

router.post(
  '/tests/:id/submit',
  submitLimiter,
  sameOriginOnly,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);

    const test = await findPublishedTest(id);
    if (!test) return notFound(res);

    const participantName = req.currentUser
      ? req.currentUser.displayName
      : String(req.body.participantName || '')
          .replace(/\s+/g, ' ')
          .trim();
    const errors = [];

    if (!participantName) errors.push('Введите ваше имя.');
    if (participantName.length > 80) errors.push('Имя слишком длинное: максимум 80 символов.');
    if (test.questions.length === 0) errors.push('В этом тесте пока нет вопросов.');

    if (errors.length > 0) {
      return res.status(422).render('test', {
        title: test.title,
        test,
        errors,
        participantName,
      });
    }

    const { score, totalQuestions, rows } = evaluateSubmission(test, req.body);

    const submission = await prisma.submission.create({
      data: {
        testId: test.id,
        participantName,
        score,
        totalQuestions,
        answers: { create: rows },
      },
    });

    try {
      await notifyNewSubmission({
        participantName,
        testTitle: test.title,
        score,
        totalQuestions,
        createdAt: submission.createdAt,
      });
    } catch (error) {
      console.error('[telegram] не удалось отправить результат:', error && error.message ? error.message : error);
    }

    return res.redirect('/thanks');
  }),
);

router.get('/thanks', (req, res) => {
  res.render('thanks', { title: 'Спасибо!' });
});

module.exports = router;
