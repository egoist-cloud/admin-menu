'use strict';

const { prisma } = require('../prisma');

function toIdList(value) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => Number.parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

/**
 * Считает результат теста и готовит строки для сохранения.
 * Ответы приходят из формы как q_<questionId> = <optionId> (одно или несколько значений).
 * Тексты вопросов и ответов сохраняются снимком, чтобы история не ломалась после редактирования теста.
 */
function evaluateSubmission(test, answers) {
  const rows = [];
  let score = 0;

  for (const question of test.questions) {
    const validIds = new Set(question.options.map((option) => option.id));
    const correctIds = question.options.filter((option) => option.isCorrect).map((option) => option.id);
    const submitted = [...new Set(toIdList(answers[`q_${question.id}`]))];

    let selectedIds = submitted.filter((id) => validIds.has(id));
    if (!question.multiple) selectedIds = selectedIds.slice(0, 1);

    const selectedOptions = selectedIds.map((id) => question.options.find((option) => option.id === id));
    const isCorrect =
      correctIds.length > 0 &&
      selectedOptions.length === correctIds.length &&
      selectedOptions.every((option) => option.isCorrect);

    if (isCorrect) score += 1;

    if (selectedOptions.length === 0) {
      rows.push({
        questionId: question.id,
        answerOptionId: null,
        questionText: question.text,
        answerText: 'Нет ответа',
        isCorrect: false,
      });
      continue;
    }

    for (const option of selectedOptions) {
      rows.push({
        questionId: question.id,
        answerOptionId: option.id,
        questionText: question.text,
        answerText: option.text,
        isCorrect,
      });
    }
  }

  return { score, totalQuestions: test.questions.length, rows };
}

module.exports = { evaluateSubmission };
