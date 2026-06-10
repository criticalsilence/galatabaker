'use client';

/**
 * JWT auth store — Zustand + persist middleware (localStorage).
 *
 * Why localStorage in MVP:
 *   - Same-site XSS exposure; CSRF not a concern (token, not cookie)
 *   - We control all script sources (no third-party tags)
 *   - Avoids an extra roundtrip to /api/auth/refresh on every page load
 *
 * Mainnet migration: switch to httpOnly secure cookie + refresh token.
 *
 * Token is *not* auto-injected into fetch here — callers (api-client)
 * read it from getToken(). Keeping fetch and storage separate makes
 * server components and tests easier.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_KEY = 'galatabaker:auth';

export interface AuthState {
  /** JWT (raw, no Bearer prefix) or null. */
  token: string | null;
  /** Wallet address from the SIWW sub claim. */
  walletPkh: string | null;
  /** Unix seconds when the JWT expires (decoded from `exp`). */
  expiresAt: number | null;
  /** True when a sign-in flow is in progress (UI uses this for spinners). */
  isSigningIn: boolean;
  /** Last sign-in error (Beacon or server), cleared on next sign-in. */
  signInError: string | null;
}

export interface AuthActions {
  signInStart: () => void;
  signInSuccess: (token: string, walletPkh: string, expiresAt: number) => void;
  setSignInError: (message: string) => void;
  signOut: () => void;
  /** True if a non-expired token is held. */
  isAuthenticated: () => boolean;
  /** Best-effort read of the current token (no rehydration on server). */
  getToken: () => string | null;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      token: null,
      walletPkh: null,
      expiresAt: null,
      isSigningIn: false,
      signInError: null,

      signInStart: () => set({ isSigningIn: true, signInError: null }),
      signInSuccess: (token, walletPkh, expiresAt) =>
        set({ token, walletPkh, expiresAt, isSigningIn: false, signInError: null }),
      setSignInError: (message) => set({ isSigningIn: false, signInError: message }),
      signOut: () => set({ token: null, walletPkh: null, expiresAt: null, signInError: null }),

      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token || !expiresAt) return false;
        // 30s leeway to avoid edge-of-expiry flicker
        return expiresAt * 1000 - Date.now() > 30_000;
      },
      getToken: () => get().token,
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only persist the durable parts. Volatile flags (isSigningIn,
      // signInError) should reset on reload.
      partialize: (s) => ({
        token: s.token,
        walletPkh: s.walletPkh,
        expiresAt: s.expiresAt,
      }),
    },
  ),
);
