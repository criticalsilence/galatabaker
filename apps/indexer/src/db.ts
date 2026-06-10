import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton — the indexer is a long-running process and
 * Vitest may load this file in a worker; without a singleton we'd
 * leak connection slots on every hot-reload.
 */

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
