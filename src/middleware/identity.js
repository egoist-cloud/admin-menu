'use strict';

const { prisma } = require('../prisma');
const { ROLES } = require('../lib/roles');

async function loadCurrentUser(req, res, next) {
  req.currentUser = null;
  req.currentRole = req.session && req.session.isAdmin ? ROLES.OWNER : null;

  if (!req.session || !req.session.userId) return next();

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      delete req.session.userId;
      return next();
    }

    req.currentUser = user;
    if (!req.session.isAdmin) req.currentRole = user.role;
    return next();
  } catch (error) {
    console.error('[auth] не удалось загрузить пользователя Steam:', error.message);
    return next();
  }
}

module.exports = { loadCurrentUser };
