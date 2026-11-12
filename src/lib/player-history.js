'use strict';

const { formatDateTime } = require('./format');

function normalizePlayerName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function playerKey(value) {
  return normalizePlayerName(value).toLowerCase();
}

function percentOf(submission) {
  const total = Number(submission.totalQuestions);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round((Number(submission.score) / total) * 100);
}

function filterSubmissionsByPlayer(submissions, name) {
  const key = playerKey(name);
  if (!key) return [];

  return submissions
    .filter((submission) => playerKey(submission.participantName) === key)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function buildPlayerHistory(submissions, name) {
  const matched = filterSubmissionsByPlayer(submissions, name);
  if (matched.length === 0) return null;

  const percentages = matched.map(percentOf);

  return {
    name: matched[0].participantName,
    total: matched.length,
    average: Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length),
    best: percentages.reduce((max, value) => Math.max(max, value), 0),
    lastAt: formatDateTime(matched[0].createdAt),
    submissions: matched.map((submission) => ({
      id: submission.id,
      testTitle: submission.test ? submission.test.title : '',
      score: submission.score,
      totalQuestions: submission.totalQuestions,
      percent: percentOf(submission),
      date: formatDateTime(submission.createdAt),
    })),
  };
}

module.exports = {
  normalizePlayerName,
  filterSubmissionsByPlayer,
  buildPlayerHistory,
};
