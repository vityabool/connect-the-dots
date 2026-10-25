import { app, type HttpRequest } from '@azure/functions';
import { HttpError, json, readJson, requireAdmin, sinceParam } from '../http';
import { createGame, defaultDeps, deleteGame, getGameIfChanged, listGames, updateGame } from '../services/games';
import { addParticipants, deleteParticipant } from '../services/participants';
import { adminDeleteConnection } from '../services/connections';
import { createShortLink, siteOrigin } from '../services/shortLink';
import { controlTimer } from '../services/timer';
import { addTopics, deleteTopic, mergeTopics } from '../services/topics';
import { getTables } from '../storage';

const deps = () => defaultDeps(getTables());

function param(request: HttpRequest, name: string): string {
  const value = request.params[name];
  if (!value) throw new HttpError(400, `Missing ${name}`);
  return value;
}

app.http('adminGames', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'manage/games',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    if (request.method === 'POST') {
      const body = await readJson(request);
      return createGame(deps(), admin.userId, body.name);
    }
    return listGames(deps(), admin.userId);
  }),
});

app.http('adminGame', {
  methods: ['GET', 'PATCH', 'DELETE'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    const gameId = param(request, 'gameId');
    if (request.method === 'DELETE') {
      await deleteGame(deps(), admin.userId, gameId);
      return undefined;
    }
    if (request.method === 'PATCH') {
      const body = await readJson(request);
      return updateGame(deps(), admin.userId, gameId, {
        name: body.name,
        expiresAt: body.expiresAt,
        shortUrl: body.shortUrl,
        rulesText: body.rulesText,
        timerMinutes: body.timerMinutes,
        showNames: body.showNames,
      });
    }
    return getGameIfChanged(deps(), admin.userId, gameId, sinceParam(request));
  }),
});

app.http('adminShortLink', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/shortlink',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    return createShortLink(deps(), admin.userId, param(request, 'gameId'), siteOrigin(request.headers, process.env.PUBLIC_ORIGIN));
  }),
});

app.http('adminParticipants', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/participants',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    const body = await readJson(request);
    return addParticipants(deps(), admin.userId, param(request, 'gameId'), body);
  }),
});

app.http('adminTopics', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/topics',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    const body = await readJson(request);
    return addTopics(deps(), admin.userId, param(request, 'gameId'), body);
  }),
});

app.http('adminParticipant', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/participants/{participantId}',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    await deleteParticipant(deps(), admin.userId, param(request, 'gameId'), param(request, 'participantId'));
    return undefined;
  }),
});

app.http('adminTopic', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/topics/{topicId}',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    return deleteTopic(deps(), admin.userId, param(request, 'gameId'), param(request, 'topicId'));
  }),
});

app.http('adminTopicMerge', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/topics/{topicId}/merge',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    const body = await readJson(request);
    return mergeTopics(deps(), admin.userId, param(request, 'gameId'), param(request, 'topicId'), body.targetId);
  }),
});

app.http('adminConnection', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/connections/{connectionId}',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    await adminDeleteConnection(deps(), admin.userId, param(request, 'gameId'), param(request, 'connectionId'));
    return undefined;
  }),
});

app.http('adminTimer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/games/{gameId}/timer',
  handler: json(async (request) => {
    const admin = requireAdmin(request);
    const body = await readJson(request);
    return controlTimer(deps(), admin.userId, param(request, 'gameId'), body.action);
  }),
});
