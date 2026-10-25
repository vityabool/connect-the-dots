import { describe, expect, it } from 'vitest';
import { healthHandler } from './health';

describe('health', () => {
  it('reports ok with a timestamp', async () => {
    const response = await healthHandler();
    const body = response.jsonBody as { status: string; time: string };
    expect(body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
