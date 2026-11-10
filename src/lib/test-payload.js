'use strict';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_QUESTION_TEXT = 1000;
const MAX_OPTION_TEXT = 500;
const MAX_QUESTIONS = 100;
const MAX_OPTIONS = 12;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Разбирает и валидирует данные формы админки.
 * Вопросы передаются JSON-строкой в поле questionsJson (её собирает public/admin.js).
 */
function parseTestForm(body) {
  const errors = [];
  const title = clean(body.title);
  const description = clean(body.description);

  if (!title) errors.push('Укажите название теста.');
  if (title.length > MAX_TITLE) errors.push(`Название теста длиннее ${MAX_TITLE} символов.`);
  if (description.length > MAX_DESCRIPTION) errors.push(`Описание длиннее ${MAX_DESCRIPTION} символов.`);

  let rawQuestions;
  try {
    rawQuestions = JSON.parse(clean(body.questionsJson) || '[]');
  } catch {
    rawQuestions = [];
    errors.push('Не удалось прочитать вопросы формы. Обновите страницу и попробуйте снова.');
  }

  if (!Array.isArray(rawQuestions)) {
    rawQuestions = [];
    errors.push('Некорректный формат вопросов.');
  }

  if (rawQuestions.length === 0) errors.push('Добавьте хотя бы один вопрос.');
  if (rawQuestions.length > MAX_QUESTIONS) errors.push(`Слишком много вопросов: максимум ${MAX_QUESTIONS}.`);

  const questions = [];

  rawQuestions.slice(0, MAX_QUESTIONS).forEach((rawQuestion, index) => {
    const number = index + 1;
    const text = clean(rawQuestion && rawQuestion.text);
    const multiple = Boolean(rawQuestion && rawQuestion.multiple);
    const rawOptions = Array.isArray(rawQuestion && rawQuestion.options) ? rawQuestion.options : [];

    if (!text) errors.push(`Вопрос ${number}: заполните текст вопроса.`);
    if (text.length > MAX_QUESTION_TEXT) errors.push(`Вопрос ${number}: текст длиннее ${MAX_QUESTION_TEXT} символов.`);

    const options = rawOptions
      .map((option) => ({ text: clean(option && option.text), isCorrect: Boolean(option && option.isCorrect) }))
      .filter((option) => option.text.length > 0);

    if (options.length > MAX_OPTIONS) {
      errors.push(`Вопрос ${number}: максимум ${MAX_OPTIONS} вариантов ответа.`);
      options.length = MAX_OPTIONS;
    }

    if (options.length < 2) errors.push(`Вопрос ${number}: нужно минимум два варианта ответа.`);

    const longOption = options.find((option) => option.text.length > MAX_OPTION_TEXT);
    if (longOption) errors.push(`Вопрос ${number}: вариант ответа длиннее ${MAX_OPTION_TEXT} символов.`);

    const correctCount = options.filter((option) => option.isCorrect).length;
    if (correctCount === 0) errors.push(`Вопрос ${number}: отметьте правильный ответ.`);
    if (!multiple && correctCount > 1) {
      errors.push(`Вопрос ${number}: для одиночного выбора можно отметить только один правильный ответ.`);
    }

    questions.push({ text, multiple, options });
  });

  return { title, description, questions, errors };
}

module.exports = { parseTestForm, MAX_TITLE, MAX_DESCRIPTION, MAX_QUESTIONS, MAX_OPTIONS };
