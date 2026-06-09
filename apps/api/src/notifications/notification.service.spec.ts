/**
 * GalataBaker API — NotificationService tests.
 *
 * In-memory prisma + mocked email/telegram senders. We exercise:
 *   - Prefs filter (emailEnabled false → no email row)
 *   - Prefs filter (rewardNotify false → no rewards_credited row)
 *   - Default prefs when user.preferences is null
 *   - Missing user → returns empty id list (no row)
 *   - Email dispatch happy → row marked sent + body filled
 *   - Email dispatch failure → row marked failed + error captured
 *   - Telegram path (chatId required, else fail)
 *   - Notification per kind (email_verify enqueue → row exists)
 */

import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service.js';

import { NOTIFICATION_CONFIG, type TelegramConfig } from './notification.config.js';
import {
  EMAIL_SENDER_TOKEN,
  NotificationService,
  TELEGRAM_PROVIDER_TOKEN,
} from './notification.service.js';

interface InMemoryNotification {
  id: string;
  userId: string;
  channel: string;
  subject: string;
  body: string;
  sent: boolean;
  sentAt: Date | null;
  readAt: Date | null;
  error: string | null;
  createdAt: Date;
}

function makePrismaStub(opts: {
  user: {
    id: string;
    walletPkh: string;
    email: string | null;
    telegramChatId: string | null;
    preferences: unknown;
  } | null;
}) {
  const rows: InMemoryNotification[] = [];
  let idSeq = 1;
  const nextId = () => `notif_${idSeq++}`;

  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(opts.user),
    },
    notification: {
      create: vi.fn().mockImplementation(({ data }: { data: Partial<InMemoryNotification> }) => {
        const row: InMemoryNotification = {
          id: nextId(),
          userId: data.userId!,
          channel: data.channel!,
          subject: data.subject!,
          body: data.body!,
          sent: data.sent ?? false,
          sentAt: data.sentAt ?? null,
          readAt: data.readAt ?? null,
          error: data.error ?? null,
          createdAt: new Date(),
        };
        rows.push(row);
        return Promise.resolve(row);
      }),
      update: vi
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Partial<InMemoryNotification> }) => {
            const row = rows.find((r) => r.id === where.id);
            if (row) Object.assign(row, data);
            return Promise.resolve(row);
          },
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi
        .fn()
        .mockImplementation(({ take, skip }: { take?: number; skip?: number } = {}) => {
          const reversed = [...rows].reverse();
          const offset = skip ?? 0;
          const limit = take ?? rows.length;
          return Promise.resolve(reversed.slice(offset, offset + limit));
        }),
      count: vi.fn().mockImplementation(() => Promise.resolve(rows.length)),
    },
    _rows: rows,
  };
}

describe('NotificationService', () => {
  let prisma: ReturnType<typeof makePrismaStub>;
  let email: { send: ReturnType<typeof vi.fn>; name: string; ping: ReturnType<typeof vi.fn> };
  let telegram: {
    sendMessage: ReturnType<typeof vi.fn>;
    name: string;
    ping: ReturnType<typeof vi.fn>;
  };
  let service: NotificationService;

  async function build(opts: {
    user: {
      id: string;
      walletPkh: string;
      email: string | null;
      telegramChatId: string | null;
      preferences: unknown;
    } | null;
    emailImpl?: ReturnType<typeof vi.fn>;
    telegramImpl?: ReturnType<typeof vi.fn>;
  }) {
    prisma = makePrismaStub({ user: opts.user });
    email = {
      name: 'email-test',
      ping: vi.fn().mockResolvedValue({ reachable: true }),
      send:
        opts.emailImpl ??
        vi.fn().mockResolvedValue({ id: 'm1', status: 'sent', provider: 'email-test' }),
    };
    telegram = {
      name: 'telegram-test',
      ping: vi.fn().mockResolvedValue({ reachable: true }),
      sendMessage:
        opts.telegramImpl ?? vi.fn().mockResolvedValue({ messageId: 123, status: 'sent' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: EMAIL_SENDER_TOKEN, useValue: email },
        { provide: TELEGRAM_PROVIDER_TOKEN, useValue: telegram },
        {
          provide: NOTIFICATION_CONFIG,
          useValue: { provider: 'noop', apiUrl: '', botToken: '' } satisfies TelegramConfig,
        },
        NotificationService,
      ],
    }).compile();

    service = moduleRef.get(NotificationService);
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('returns [] when user does not exist', async () => {
    await build({ user: null });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'register_confirmation',
      vars: { walletPkh: TEST_PKH },
    });
    expect(ids).toEqual([]);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('email verify: enqueue creates EMAIL row and dispatches', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: null,
        preferences: {},
      },
    });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'email_verify',
      vars: { email: 'a@b.com', link: 'https://x/y' },
      channels: ['EMAIL'],
    });
    expect(ids).toHaveLength(1);
    expect(email.send).toHaveBeenCalledOnce();
    const row = prisma._rows[0]!;
    expect(row.channel).toBe('EMAIL');
    expect(row.sent).toBe(true);
    expect(row.body).toContain('https://x/y');
  });

  it('respects emailEnabled=false: skips email channel', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: null,
        preferences: { emailEnabled: false },
      },
    });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'register_confirmation',
      vars: { walletPkh: TEST_PKH },
    });
    expect(ids).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('respects rewardNotify=false: skips rewards_credited', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: '12345',
        preferences: { rewardNotify: false },
      },
    });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'rewards_credited',
      vars: { amount: '5', bakerAlias: 'Galata', bakerPkh: 'tz1y', cycle: 100 },
    });
    expect(ids).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('email send failure → row marked failed, error captured', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: null,
        preferences: {},
      },
      emailImpl: vi
        .fn()
        .mockResolvedValue({
          id: '',
          status: 'failed',
          provider: 'email-test',
          error: 'SMTP ECONNREFUSED',
        }),
    });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'register_confirmation',
      vars: { walletPkh: TEST_PKH },
    });
    expect(ids).toHaveLength(1);
    const row = prisma._rows[0]!;
    expect(row.sent).toBe(false);
    expect(row.error).toBe('SMTP ECONNREFUSED');
  });

  it('telegram send failure → row marked failed, error captured', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: null,
        telegramChatId: '12345',
        preferences: { telegramEnabled: true },
      },
      telegramImpl: vi
        .fn()
        .mockResolvedValue({ messageId: 0, status: 'failed', error: 'Telegram 403' }),
    });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'telegram_link',
      vars: {},
      channels: ['TELEGRAM'],
    });
    expect(ids).toHaveLength(1);
    const row = prisma._rows[0]!;
    expect(row.sent).toBe(false);
    expect(row.error).toBe('Telegram 403');
  });

  it('telegram without chatId → row created, marked failed with "No telegramChatId"', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: null,
        preferences: { telegramEnabled: true },
      },
    });
    const ids = await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'telegram_link',
      vars: {},
      channels: ['TELEGRAM'],
    });
    expect(ids).toHaveLength(1);
    const row = prisma._rows[0]!;
    expect(row.sent).toBe(false);
    expect(row.error).toBe('No telegramChatId on user');
  });

  it('markRead: returns {marked: true} for unread notification', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: null,
        preferences: { telegramEnabled: true },
      },
    });
    // First, create a row.
    await service.enqueue({
      walletPkh: TEST_PKH,
      kind: 'register_confirmation',
      vars: { walletPkh: TEST_PKH },
    });
    const id = prisma._rows[0]!.id;
    const r = await service.markRead(TEST_PKH, id);
    expect(r.marked).toBe(true);
  });

  it('listByUser: returns paginated data, total, unreadCount', async () => {
    await build({
      user: {
        id: 'u1',
        walletPkh: TEST_PKH,
        email: 'a@b.com',
        telegramChatId: null,
        preferences: {},
      },
    });
    // Seed 3 notifications
    for (let i = 0; i < 3; i++) {
      await service.enqueue({
        walletPkh: TEST_PKH,
        kind: 'register_confirmation',
        vars: { walletPkh: TEST_PKH },
      });
    }
    const r = await service.listByUser(TEST_PKH, { limit: 2, offset: 0 });
    expect(r.data).toHaveLength(2);
    expect(r.total).toBe(3);
    expect(r.unreadCount).toBe(3);
  });
});

/**
 * Test PKH fixture: 36-char tz1 address (Zod regex requires exactly 36).
 * `tz1` prefix + 33 base58 characters. `a…a` padding keeps it valid and
 * unique enough for in-memory lookups.
 */
const TEST_PKH = 'tz1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
