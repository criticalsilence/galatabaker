/**
 * GalataBaker web — wire shape returned by GET /api/health.
 */
export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
  service: string;
  version: string;
}
