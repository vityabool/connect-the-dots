import { app, type HttpResponseInit } from '@azure/functions';

export async function healthHandler(): Promise<HttpResponseInit> {
  return { jsonBody: { status: 'ok', time: new Date().toISOString() } };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
});
