import { BeaconWallet } from '@taquito/beacon-wallet';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createWallet, isAnyWalletAvailable } from './wallet.js';

vi.mock('@taquito/beacon-wallet', () => {
  return {
    BeaconWallet: vi.fn().mockImplementation(() => ({
      client: {
        subscribeToEvent: vi.fn(),
        getActiveAccount: vi.fn().mockResolvedValue(null),
        getAvailableWallets: vi.fn().mockResolvedValue([]),
        removeAllAccounts: vi.fn().mockResolvedValue(undefined),
        removeAllPeers: vi.fn().mockResolvedValue(undefined),
      },
      requestPermissions: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset window between tests
  delete (globalThis as { window?: unknown }).window;
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** Test-only: minimal window mock with controllable localStorage + globals. */
function mockWindow(
  opts: {
    globals?: Record<string, unknown>;
    storage?: Record<string, string>;
  } = {},
) {
  const store = new Map<string, string>(Object.entries(opts.storage ?? {}));
  const win = {
    temple: opts.globals?.temple,
    kukai: opts.globals?.kukai,
    galleon: opts.globals?.galleon,
    beacon: opts.globals?.beacon,
    localStorage: {
      get length() {
        return store.size;
      },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
  };
  (globalThis as unknown as { window: unknown }).window = win;
  return { win, store };
}

describe('createWallet', () => {
  it('returns an object with the expected methods', () => {
    const w = createWallet();
    expect(w.getAddress).toBeTypeOf('function');
    expect(w.requestPermissions).toBeTypeOf('function');
    expect(w.disconnectOnBeacon).toBeTypeOf('function');
    expect(w.getActiveAccount).toBeTypeOf('function');
    expect(w.destroy).toBeTypeOf('function');
    expect(w.getBeaconWallet).toBeTypeOf('function');
  });

  it('instantiates BeaconWallet under the hood', () => {
    createWallet();
    expect(BeaconWallet).toHaveBeenCalled();
  });

  it('getActiveAccount returns null when no account is connected', async () => {
    const w = createWallet();
    expect(await w.getActiveAccount()).toBeNull();
  });

  it('getAddress throws when no account is connected', async () => {
    const w = createWallet();
    await expect(w.getAddress()).rejects.toThrow(/No active Beacon account/);
  });
});

describe('isAnyWalletAvailable', () => {
  it('returns false when window is undefined (SSR)', async () => {
    expect(await isAnyWalletAvailable(100)).toBe(false);
  });

  it('returns true synchronously when window.temple is defined', async () => {
    mockWindow({ globals: { temple: {} } });
    expect(await isAnyWalletAvailable(100)).toBe(true);
    // Should not even need to call Beacon SDK
    expect(BeaconWallet).not.toHaveBeenCalled();
  });

  it('returns true synchronously when window.beacon is defined', async () => {
    mockWindow({ globals: { beacon: {} } });
    expect(await isAnyWalletAvailable(100)).toBe(true);
    expect(BeaconWallet).not.toHaveBeenCalled();
  });

  it('returns true synchronously for Kukai and Galleon globals', async () => {
    mockWindow({ globals: { kukai: {} } });
    expect(await isAnyWalletAvailable(100)).toBe(true);

    mockWindow({ globals: { galleon: {} } });
    expect(await isAnyWalletAvailable(100)).toBe(true);
  });

  it('falls back to async Beacon postMessage and returns true when wallet responds', async () => {
    mockWindow({});
    vi.mocked(BeaconWallet).mockImplementationOnce(
      () =>
        ({
          client: {
            subscribeToEvent: vi.fn(),
            getActiveAccount: vi.fn(),
            getAvailableWallets: vi.fn().mockResolvedValue([{ key: 'temple' }]),
            removeAllAccounts: vi.fn(),
            removeAllPeers: vi.fn(),
          },
          requestPermissions: vi.fn(),
          disconnect: vi.fn(),
        }) as unknown as BeaconWallet,
    );
    expect(await isAnyWalletAvailable(500)).toBe(true);
  });

  it('returns false when async detection times out', async () => {
    mockWindow({});
    vi.mocked(BeaconWallet).mockImplementationOnce(
      () =>
        ({
          client: {
            subscribeToEvent: vi.fn(),
            getActiveAccount: vi.fn(),
            getAvailableWallets: vi.fn().mockImplementation(
              () => new Promise(() => {}), // never resolves
            ),
            removeAllAccounts: vi.fn(),
            removeAllPeers: vi.fn(),
          },
          requestPermissions: vi.fn(),
          disconnect: vi.fn(),
        }) as unknown as BeaconWallet,
    );
    expect(await isAnyWalletAvailable(50)).toBe(false);
  });
});

describe('destroy', () => {
  it('removes Beacon-related localStorage keys', async () => {
    const { store } = mockWindow({
      storage: {
        'beacon:pair': 'data',
        'beacon:active-account': 'tz1xxx',
        '@airgap/transport': 'data',
        'dappclient:peers': 'peers',
        'matrix-session': 'session',
        'unrelated-key': 'keep-me',
      },
    });
    const w = createWallet();
    await w.destroy();
    expect(store.has('beacon:pair')).toBe(false);
    expect(store.has('beacon:active-account')).toBe(false);
    expect(store.has('@airgap/transport')).toBe(false);
    expect(store.has('dappclient:peers')).toBe(false);
    expect(store.has('matrix-session')).toBe(false);
    expect(store.get('unrelated-key')).toBe('keep-me');
  });

  it('clears accounts and peers even if disconnect throws ("Not connected")', async () => {
    // Gerçek Beacon SDK 4.8.x davranışı: transport kurulmamışsa
    // disconnect() "Not connected." fırlatıyor. removeAllAccounts/Peers
    // buna rağmen çağrılmalı — yoksa sonraki sayfa yüklemesi eski
    // hesabı otomatik restore ediyor.
    const { store } = mockWindow({
      storage: { 'beacon:active-account': 'tz1xxx', 'beacon:peers': 'peers' },
    });
    const removeAllAccounts = vi.fn().mockResolvedValue(undefined);
    const removeAllPeers = vi.fn().mockResolvedValue(undefined);
    vi.mocked(BeaconWallet).mockImplementationOnce(
      () =>
        ({
          client: {
            subscribeToEvent: vi.fn(),
            getActiveAccount: vi.fn(),
            getAvailableWallets: vi.fn(),
            removeAllAccounts,
            removeAllPeers,
          },
          requestPermissions: vi.fn(),
          disconnect: vi.fn().mockRejectedValue(new Error('Not connected.')),
        }) as unknown as BeaconWallet,
    );

    const w = createWallet();
    await expect(w.destroy()).resolves.toBeUndefined();
    expect(removeAllAccounts).toHaveBeenCalled();
    expect(removeAllPeers).toHaveBeenCalled();
    // localStorage da temizlendi mi?
    expect(store.has('beacon:active-account')).toBe(false);
    expect(store.has('beacon:peers')).toBe(false);
  });

  it('returns within ~1.5s when an SDK call hangs forever (no resolve, no reject)', async () => {
    // Beacon SDK 4.8.x gerçek davranışı: removeAllPeers transport durumuna
    // bağlı olarak ASILIP KALABİLİR (reject bile etmez). destroy() sonsuza
    // kadar beklememeli — safeBeaconCall timeout'u kazanmalı ve cleanup
    // yine de tamamlanmalı.
    const { store } = mockWindow({
      storage: { 'beacon:active-account': 'tz1xxx' },
    });
    const removeAllAccounts = vi.fn().mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    vi.mocked(BeaconWallet).mockImplementationOnce(
      () =>
        ({
          client: {
            subscribeToEvent: vi.fn(),
            getActiveAccount: vi.fn(),
            getAvailableWallets: vi.fn(),
            removeAllAccounts,
            removeAllPeers: vi.fn().mockResolvedValue(undefined),
          },
          requestPermissions: vi.fn(),
          disconnect: vi.fn().mockResolvedValue(undefined),
        }) as unknown as BeaconWallet,
    );

    const w = createWallet();
    const start = Date.now();
    await w.destroy();
    const elapsed = Date.now() - start;

    // removeAllAccounts 1.5s timeout'la atlandı, sonrakiler hemen döndü.
    // Toplam süre 1.5s civarı olmalı (3 × 1.5s'den az).
    expect(elapsed).toBeLessThan(3000);
    expect(elapsed).toBeGreaterThanOrEqual(1400);
    expect(removeAllAccounts).toHaveBeenCalled();
    // localStorage temizliği yine de tamamlandı (timeout sonrası cleanup)
    expect(store.has('beacon:active-account')).toBe(false);
  });

  it('is a no-op when window is undefined (SSR)', async () => {
    const w = createWallet();
    await expect(w.destroy()).resolves.toBeUndefined();
  });
});
