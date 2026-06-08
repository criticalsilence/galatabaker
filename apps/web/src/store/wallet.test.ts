import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// sessionStorage polyfill (vitest node environment) — vi.hoisted ile
// import'lar çalışmadan önce global'e enjekte edilir.
vi.hoisted(() => {
  const sessionStore = new Map<string, string>();
  const sessionStorageMock = {
    get length() {
      return sessionStore.size;
    },
    key: (i: number) => Array.from(sessionStore.keys())[i] ?? null,
    getItem: (k: string) => sessionStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      sessionStore.set(k, v);
    },
    removeItem: (k: string) => {
      sessionStore.delete(k);
    },
    clear: () => {
      sessionStore.clear();
    },
  };
  (globalThis as { sessionStorage?: Storage }).sessionStorage =
    sessionStorageMock as unknown as Storage;
});

const { mockWallet } = vi.hoisted(() => ({
  mockWallet: {
    requestPermissions: vi.fn(),
    getActiveAccount: vi.fn(),
    getAddress: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn(),
    getBeaconWallet: vi.fn(),
  },
}));

vi.mock('@galatabaker/sdk/wallet', () => ({
  createWallet: vi.fn(() => mockWallet),
  isAnyWalletAvailable: vi.fn(),
}));

import { useWallet } from './wallet.js';

beforeEach(() => {
  vi.clearAllMocks();
  // mockResolvedValueOnce queue'larını temizle (clearAllMocks bunu yapmaz).
  // Her test kendi wallet davranışını izole kurar; createWallet mock'u
  // korunur (sadece call count temizlenir).
  mockWallet.getActiveAccount.mockReset();
  mockWallet.requestPermissions.mockReset();
  mockWallet.destroy.mockReset();
  try {
    sessionStorage.clear();
  } catch {
    // yoksay
  }
  useWallet.setState({
    wallet: null,
    address: null,
    publicKey: null,
    isConnected: false,
    isConnecting: false,
    isRestoring: false,
    error: null,
  });
});

afterEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    // yoksay
  }
});

describe('useWallet.connect', () => {
  it('extracts useful message from BeaconError-like throw', async () => {
    const beaconError = Object.assign(new Error('WalletNotFound'), {
      title: 'WalletNotFound',
      description: 'No Tezos wallet extension found',
    });
    mockWallet.requestPermissions.mockRejectedValueOnce(beaconError);
    mockWallet.getActiveAccount.mockResolvedValue(null);

    await useWallet.getState().connect();

    const state = useWallet.getState();
    expect(state.error).toBe('No Tezos wallet extension found');
    expect(state.isConnected).toBe(false);
  });

  it('handles plain object throw without "[object Object]"', async () => {
    // Temple bridge bazen bu şekilde fırlatıyor
    mockWallet.requestPermissions.mockRejectedValueOnce({
      description: 'User rejected the connection',
    });

    await useWallet.getState().connect();

    const state = useWallet.getState();
    expect(state.error).toBe('User rejected the connection');
    expect(state.error).not.toBe('[object Object]');
    expect(state.error).not.toContain('[object Object]');
  });

  it('handles plain object with message field', async () => {
    mockWallet.requestPermissions.mockRejectedValueOnce({
      message: 'Pairing failed: timeout',
    });

    await useWallet.getState().connect();

    expect(useWallet.getState().error).toBe('Pairing failed: timeout');
  });

  it('handles empty object gracefully (no "[object Object]")', async () => {
    mockWallet.requestPermissions.mockRejectedValueOnce({});

    await useWallet.getState().connect();

    const err = useWallet.getState().error;
    expect(err).toBeTruthy();
    expect(err).not.toBe('[object Object]');
  });

  it('clears disconnect flag on successful connect', async () => {
    sessionStorage.setItem('galatabaker:disconnected', '1');
    mockWallet.requestPermissions.mockResolvedValueOnce(undefined);
    mockWallet.getActiveAccount.mockResolvedValueOnce({
      address: 'tz1test',
      publicKey: 'edpkxxx',
    });

    await useWallet.getState().connect();

    expect(sessionStorage.getItem('galatabaker:disconnected')).toBeNull();
    expect(useWallet.getState().isConnected).toBe(true);
    expect(useWallet.getState().address).toBe('tz1test');
  });
});

describe('useWallet.disconnect', () => {
  it('sets disconnect flag in sessionStorage', async () => {
    useWallet.setState({
      wallet: mockWallet as never,
      address: 'tz1test',
      isConnected: true,
    });
    mockWallet.destroy.mockResolvedValueOnce(undefined);

    await useWallet.getState().disconnect();

    expect(sessionStorage.getItem('galatabaker:disconnected')).toBe('1');
    expect(useWallet.getState().isConnected).toBe(false);
    expect(useWallet.getState().address).toBeNull();
  });

  it('clears state even if destroy throws', async () => {
    useWallet.setState({
      wallet: mockWallet as never,
      address: 'tz1test',
      isConnected: true,
    });
    mockWallet.destroy.mockRejectedValueOnce(new Error('boom'));

    await useWallet.getState().disconnect();

    expect(useWallet.getState().isConnected).toBe(false);
    expect(useWallet.getState().address).toBeNull();
    expect(sessionStorage.getItem('galatabaker:disconnected')).toBe('1');
  });
});

describe('useWallet.restoreSession', () => {
  it('skips restore when disconnect flag is set', async () => {
    sessionStorage.setItem('galatabaker:disconnected', '1');
    mockWallet.getActiveAccount.mockResolvedValueOnce({
      address: 'tz1test',
      publicKey: 'edpkxxx',
    });

    await useWallet.getState().restoreSession();

    expect(useWallet.getState().isConnected).toBe(false);
    expect(mockWallet.getActiveAccount).not.toHaveBeenCalled();
  });

  it('restores session when Beacon has active account and no flag', async () => {
    mockWallet.getActiveAccount.mockResolvedValueOnce({
      address: 'tz1restored',
      publicKey: 'edpkxxx',
    });

    await useWallet.getState().restoreSession();

    expect(useWallet.getState().isConnected).toBe(true);
    expect(useWallet.getState().address).toBe('tz1restored');
  });

  it('leaves state disconnected when Beacon has no account', async () => {
    mockWallet.getActiveAccount.mockResolvedValueOnce(null);

    await useWallet.getState().restoreSession();

    expect(useWallet.getState().isConnected).toBe(false);
  });
});
