/**
 * API base URL — single source of truth for the backend.
 *
 * Injected at build time via \`NEXT_PUBLIC_API_URL\`. Default for local dev
 * points at the NestJS server in apps/api.
 *
 * Why a single constant (not env reads scattered through the code):
 *   - One place to swap URLs per env (preview, staging, production)
 *   - Easy to mock in tests
 *   - Tree-shakeable: dead-code-elimination drops unused code paths
 */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api';
