'use strict';

/**
 * Настройки TLS для пула сессий (pg).
 *
 * pg-connection-string v3 трактует sslmode=require как verify-full и требует
 * CA-сертификат, которого у Aiven/Neon нет в доверенных. Prisma использует
 * свой TLS-стек и работает с require корректно, а pg — нет.
 *
 * uselibpqcompat=true возвращает поведение libpq: TLS включён, сертификат
 * не проверяется. Для verify-ca/verify-full флаг не добавляем.
 */
function pgConnectionString(connectionString) {
  if (/[?&]uselibpqcompat=/i.test(connectionString)) return connectionString;
  if (/[?&]sslmode=(require|prefer|verify-ca)/i.test(connectionString)) {
    return `${connectionString}${connectionString.includes('?') ? '&' : '?'}uselibpqcompat=true`;
  }
  return connectionString;
}

function sslConfig(connectionString) {
  if (/sslmode=verify-(ca|full)/i.test(connectionString)) return undefined;
  if (/[?&]sslmode=disable/i.test(connectionString)) return false;
  if (/@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(connectionString)) return false;
  return { rejectUnauthorized: false };
}

module.exports = { pgConnectionString, sslConfig };
