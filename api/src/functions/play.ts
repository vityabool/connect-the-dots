import { app, type HttpRequest } from '@azure/functions';
import { clientAddress, HttpError, json, readJson, sinceParam } from '../http';
import { requireSigningSecret } from '../playerToken';
import { defaultDeps } from '../services/games';
import {
  authenticate,
  authenticateIdentified,
  createConnection,
  deleteConnection,
  getPlayStateIfChanged,
  joinGame,
  pickIdentity,
} from '../services/play';
import { getTables } from '../storage';

const deps = () => defaultDeps(getTables());

function secret(): string {
  return requireSigningSecret(process.env.TOKEN_SIGNING_SECRET);
}

/** Players send the token they got from /play/join (or /play/identity) in this header. */
function token(request: HttpRequest): string | null {
  return request.headers.get('x-player-token');
}

app.http('playJoin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'play/join',
  handler: json(async (request) => {
    const body = await readJson(request);
    return joinGame(deps(), secret(), body.code, clientAddress(request));
  }),
});

app.http('playIdentity', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'play/identity',
  handler: json(async (request) => {
    const d = deps();
    const ctx = await authenticate(d, secret(), token(request));
    const body = await readJson(request);
    return pickIdentity(d, secret(), ctx, body.participantId);
  }),
});

app.http('playState', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'play/state',
  handler: json(async (request) => {
    const d = deps();
    const ctx = await authenticateIdentified(d, secret(), token(request));
    return getPlayStateIfChanged(d, ctx, sinceParam(request));
  }),
});

app.http('playConnections', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'play/connections',
  handler: json(async (request) => {
    const d = deps();
    const ctx = await authenticateIdentified(d, secret(), token(request));
    const body = await readJson(request);
    return createConnection(d, ctx, {
      otherId: body.otherId as string | undefined,
      topicId: body.topicId as string | undefined,
      newTopicName: body.newTopicName as string | undefined,
    });
  }),
});

app.http('playConnection', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'play/connections/{connectionId}',
  handler: json(async (request) => {
    const d = deps();
    const ctx = await authenticateIdentified(d, secret(), token(request));
    const connectionId = request.params.connectionId;
    if (!connectionId) throw new HttpError(400, 'Missing connectionId');
    await deleteConnection(d, ctx, connectionId);
    return undefined;
  }),
});
