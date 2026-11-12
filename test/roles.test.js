'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ROLES,
  isStaff,
  canManageRoles,
  assignableRoles,
  canAssignRole,
  roleLabel,
} = require('../src/lib/roles');

test('владелец, старшие админы и админы считаются staff, игроки — нет', () => {
  assert.equal(isStaff(ROLES.OWNER), true);
  assert.equal(isStaff(ROLES.SENIOR_ADMIN), true);
  assert.equal(isStaff(ROLES.ADMIN), true);
  assert.equal(isStaff(ROLES.PLAYER), false);
  assert.equal(isStaff(null), false);
});

test('управлять ролями могут только владелец и старший админ', () => {
  assert.equal(canManageRoles(ROLES.OWNER), true);
  assert.equal(canManageRoles(ROLES.SENIOR_ADMIN), true);
  assert.equal(canManageRoles(ROLES.ADMIN), false);
  assert.equal(canManageRoles(ROLES.PLAYER), false);
});

test('владелец может выдать старшего админа, админа и игрока', () => {
  assert.deepEqual(assignableRoles(ROLES.OWNER, ROLES.PLAYER), [
    ROLES.SENIOR_ADMIN,
    ROLES.ADMIN,
    ROLES.PLAYER,
  ]);
  assert.equal(canAssignRole(ROLES.OWNER, ROLES.PLAYER, ROLES.SENIOR_ADMIN), true);
  assert.equal(canAssignRole(ROLES.OWNER, ROLES.SENIOR_ADMIN, ROLES.ADMIN), true);
});

test('старший админ может выдавать только админа и игрока', () => {
  assert.deepEqual(assignableRoles(ROLES.SENIOR_ADMIN, ROLES.PLAYER), [
    ROLES.ADMIN,
    ROLES.PLAYER,
  ]);
  assert.equal(canAssignRole(ROLES.SENIOR_ADMIN, ROLES.PLAYER, ROLES.ADMIN), true);
  assert.equal(canAssignRole(ROLES.SENIOR_ADMIN, ROLES.PLAYER, ROLES.PLAYER), true);
  assert.equal(canAssignRole(ROLES.SENIOR_ADMIN, ROLES.PLAYER, ROLES.SENIOR_ADMIN), false);
  assert.equal(canAssignRole(ROLES.SENIOR_ADMIN, ROLES.SENIOR_ADMIN, ROLES.PLAYER), false);
});

test('роль владельца нельзя выдать через панель, а обычный админ не управляет ролями', () => {
  assert.equal(canAssignRole(ROLES.OWNER, ROLES.PLAYER, ROLES.OWNER), false);
  assert.equal(canAssignRole(ROLES.ADMIN, ROLES.PLAYER, ROLES.ADMIN), false);
  assert.deepEqual(assignableRoles(ROLES.ADMIN, ROLES.PLAYER), []);
});

test('названия ролей совпадают с интерфейсом', () => {
  assert.equal(roleLabel(ROLES.OWNER), 'Владелец');
  assert.equal(roleLabel(ROLES.SENIOR_ADMIN), 'Ст. админ');
  assert.equal(roleLabel(ROLES.ADMIN), 'Админ');
  assert.equal(roleLabel(ROLES.PLAYER), 'Игрок');
  assert.equal(roleLabel('UNKNOWN'), 'Игрок');
});
