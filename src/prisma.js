'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG === 'query' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

module.exports = { prisma };
