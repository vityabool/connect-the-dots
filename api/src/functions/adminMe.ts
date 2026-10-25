import { app, type HttpRequest, type HttpResponseInit } from '@azure/functions';
import { parsePrincipal } from '../auth';

export async function adminMeHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const principal = parsePrincipal(request.headers.get('x-ms-client-principal'));
  if (!principal) return { status: 401, jsonBody: { error: 'Not signed in' } };
  return {
    jsonBody: {
      displayName: principal.userDetails,
      identityProvider: principal.identityProvider,
    },
  };
}

app.http('adminMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/me',
  handler: adminMeHandler,
});
