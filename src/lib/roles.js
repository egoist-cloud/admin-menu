'use strict';

const ROLES = {
  OWNER: 'OWNER',
  SENIOR_ADMIN: 'SENIOR_ADMIN',
  ADMIN: 'ADMIN',
  PLAYER: 'PLAYER',
};

const ASSIGNABLE_ROLES = [ROLES.SENIOR_ADMIN, ROLES.ADMIN, ROLES.PLAYER];
const STAFF_ROLES = new Set([ROLES.OWNER, ROLES.SENIOR_ADMIN, ROLES.ADMIN]);

const LABELS = {
  [ROLES.OWNER]: 'Владелец',
  [ROLES.SENIOR_ADMIN]: 'Ст. админ',
  [ROLES.ADMIN]: 'Админ',
  [ROLES.PLAYER]: 'Игрок',
};

function isStaff(role) {
  return STAFF_ROLES.has(role);
}

function canManageRoles(role) {
  return role === ROLES.OWNER || role === ROLES.SENIOR_ADMIN;
}

function assignableRoles(actorRole, targetRole) {
  if (actorRole === ROLES.OWNER) return ASSIGNABLE_ROLES.slice();
  if (actorRole !== ROLES.SENIOR_ADMIN) return [];
  if (targetRole === ROLES.OWNER || targetRole === ROLES.SENIOR_ADMIN) return [];
  return [ROLES.ADMIN, ROLES.PLAYER];
}

function canAssignRole(actorRole, targetRole, nextRole) {
  if (nextRole === ROLES.OWNER) return false;
  return assignableRoles(actorRole, targetRole).includes(nextRole);
}

function roleLabel(role) {
  return LABELS[role] || 'Игрок';
}

module.exports = {
  ROLES,
  ASSIGNABLE_ROLES,
  isStaff,
  canManageRoles,
  assignableRoles,
  canAssignRole,
  roleLabel,
};
