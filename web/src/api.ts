import type {
  AddParticipantsResult,
  AddTopicsResult,
  CreateConnectionInput,
  DeleteTopicResult,
  GameDetails,
  GameSummary,
  JoinResult,
  MergeTopicsResult,
  MyConnection,
  Participant,
  PlayState,
  TimerAction,
  TimerState,
  Unchanged,
} from '@ctd/shared';

import { strings } from './strings';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // redirect: 'manual' so an expired Microsoft sign-in (the platform answers with a redirect to the
  // login page) is recognised instead of ending in a confusing cross-site network error.
  const response = await fetch(path, {
    ...init,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (response.type === 'opaqueredirect') throw new ApiError(401, strings.sessionExpired);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep the generic message
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Admin {
  displayName: string;
  identityProvider: string;
}

export const adminApi = {
  me: () => request<Admin>('/api/manage/me'),
  listGames: () => request<GameSummary[]>('/api/manage/games'),
  createGame: (name: string) =>
    request<GameSummary>('/api/manage/games', { method: 'POST', body: JSON.stringify({ name }) }),
  getGame: (id: string, since?: number) =>
    request<GameDetails | Unchanged>(`/api/manage/games/${id}${since === undefined ? '' : `?since=${since}`}`),
  updateGame: (
    id: string,
    patch: {
      name?: string;
      expiresAt?: string;
      shortUrl?: string;
      rulesText?: string;
      timerMinutes?: number;
      showNames?: boolean;
    },
  ) =>
    request<GameSummary>(`/api/manage/games/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  createShortLink: (id: string) =>
    request<{ shortUrl: string }>(`/api/manage/games/${id}/shortlink`, { method: 'POST', body: '{}' }),
  deleteGame: (id: string) => request<void>(`/api/manage/games/${id}`, { method: 'DELETE' }),
  timer: (id: string, action: TimerAction) =>
    request<TimerState>(`/api/manage/games/${id}/timer`, { method: 'POST', body: JSON.stringify({ action }) }),
  addParticipants: (id: string, text: string) =>
    request<AddParticipantsResult>(`/api/manage/games/${id}/participants`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  addTopics: (id: string, text: string) =>
    request<AddTopicsResult>(`/api/manage/games/${id}/topics`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  deleteTopic: (gameId: string, topicId: string) =>
    request<DeleteTopicResult>(`/api/manage/games/${gameId}/topics/${encodeURIComponent(topicId)}`, {
      method: 'DELETE',
    }),
  mergeTopic: (gameId: string, sourceId: string, targetId: string) =>
    request<MergeTopicsResult>(`/api/manage/games/${gameId}/topics/${encodeURIComponent(sourceId)}/merge`, {
      method: 'POST',
      body: JSON.stringify({ targetId }),
    }),
  deleteConnection: (gameId: string, connectionId: string) =>
    request<void>(`/api/manage/games/${gameId}/connections/${encodeURIComponent(connectionId)}`, {
      method: 'DELETE',
    }),
  deleteParticipant: (gameId: string, participantId: string) =>
    request<void>(`/api/manage/games/${gameId}/participants/${encodeURIComponent(participantId)}`, {
      method: 'DELETE',
    }),
};

export const playApi = {
  join: (code: string) =>
    request<JoinResult>('/api/play/join', { method: 'POST', body: JSON.stringify({ code }) }),
  pickIdentity: (token: string, participantId: string) =>
    request<{ token: string; me: Participant }>('/api/play/identity', {
      method: 'POST',
      headers: { 'x-player-token': token },
      body: JSON.stringify({ participantId }),
    }),
  state: (token: string, since?: number) =>
    request<PlayState | Unchanged>(`/api/play/state${since === undefined ? '' : `?since=${since}`}`, {
      headers: { 'x-player-token': token },
    }),
  addConnection: (token: string, input: CreateConnectionInput) =>
    request<MyConnection>('/api/play/connections', {
      method: 'POST',
      headers: { 'x-player-token': token },
      body: JSON.stringify(input),
    }),
  deleteConnection: (token: string, id: string) =>
    request<void>(`/api/play/connections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-player-token': token },
    }),
};
