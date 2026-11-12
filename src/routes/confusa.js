'use strict';

const express = require('express');

const config = require('../config');
const { prisma } = require('../prisma');
const { asyncHandler } = require('../lib/async-handler');
const { normalizePlayerName } = require('../lib/player-history');
const roles = require('../lib/roles');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

function flash(req, type, text) {
  req.session.flash = { type, text };
}

function renderForbidden(res, message) {
  return res.status(403).render('error', {
    title: 'Недостаточно прав',
    status: 403,
    message,
  });
}

function parseUserId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const canManage = roles.canManageRoles(req.currentRole);
    const users = canManage
      ? (await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })).map((user) => ({
          ...user,
          options: roles.assignableRoles(req.currentRole, user.role),
        }))
      : [];

    res.render('confusa', {
      title: 'Confusa',
      users,
      canManageRoles: canManage,
      ownerName: config.admin.username || 'admin',
      error:
        req.query.error === 'steam'
          ? 'Не удалось войти через Steam. Попробуйте ещё раз.'
          : '',
    });
  }),
);

router.post(
  '/profile',
  csrfProtection,
  asyncHandler(async (req, res) => {
    if (!req.currentUser) return res.redirect('/confusa');

    const displayName = normalizePlayerName(req.body.displayName);
    if (displayName.length < 2 || displayName.length > 40) {
      flash(req, 'error', 'Имя должно быть от 2 до 40 символов.');
      return res.redirect('/confusa');
    }

    const duplicate = await prisma.user.findFirst({
      where: {
        displayName: { equals: displayName, mode: 'insensitive' },
        NOT: { id: req.currentUser.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      flash(req, 'error', 'Такое имя уже занято. Выберите другое.');
      return res.redirect('/confusa');
    }

    await prisma.user.update({
      where: { id: req.currentUser.id },
      data: { displayName },
    });

    flash(req, 'success', 'Имя в Confusa обновлено.');
    return res.redirect('/confusa');
  }),
);

router.post(
  '/users/:id/role',
  csrfProtection,
  asyncHandler(async (req, res) => {
    if (!roles.canManageRoles(req.currentRole)) {
      return renderForbidden(res, 'Управлять ролями может только владелец или старший админ.');
    }

    const id = parseUserId(req.params.id);
    if (!id) return renderForbidden(res, 'Некорректный пользователь.');

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return renderForbidden(res, 'Пользователь не найден.');

    if (req.currentUser && req.currentUser.id === target.id) {
      return renderForbidden(res, 'Нельзя изменить собственную роль.');
    }

    const nextRole = String(req.body.role || '');
    if (!roles.canAssignRole(req.currentRole, target.role, nextRole)) {
      return renderForbidden(res, 'Эту роль нельзя выдать.');
    }

    await prisma.user.update({
      where: { id },
      data: { role: nextRole },
    });

    flash(req, 'success', `${target.displayName}: роль изменена на «${roles.roleLabel(nextRole)}».`);
    return res.redirect('/confusa');
  }),
);

module.exports = router;
