'use strict';

const config = require('../config');

let dateTimeFormatter;
try {
  dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
} catch {
  dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

function formatPercent(score, total) {
  if (!total) return '0%';
  return `${Math.round((Number(score) / Number(total)) * 100)}%`;
}

function formatFileDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: config.timezone }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function plural(count, forms) {
  const number = Math.abs(Number(count)) % 100;
  const last = number % 10;
  if (number > 10 && number < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

module.exports = { formatDateTime, formatPercent, formatFileDate, escapeHtml, plural };
