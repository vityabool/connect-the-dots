import { ApiError, adminApi } from '../api';
import { messageOf } from './format';
import { useLive, type Live } from '../live';
import type { GameDetails, StatEdge, StatPerson } from '@ctd/shared';
import type { GraphEdge, GraphNode } from '../graph/NetworkGraph';

/** Keeps one game's details fresh (polling); used by the game page, Timer screen and results. */
export function useGame(gameId: string, onFatal?: (message: string) => void): Live<GameDetails> {
  return useLive<GameDetails>({
    key: gameId,
    fetch: (since) => adminApi.getGame(gameId, since),
    versionOf: (g) => g.version,
    isFatal: (e) => e instanceof ApiError && (e.status === 404 || e.status === 401),
    onFatal: (e) => onFatal?.(messageOf(e)),
  });
}

/** The game's data in the shapes the graph and the statistics expect. */
export function graphData(game: GameDetails): {
  people: StatPerson[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  statEdges: StatEdge[];
} {
  return {
    people: game.participants,
    nodes: game.participants.map((p) => ({ id: p.id, label: p.name })),
    edges: game.connections.map((c) => ({ id: c.id, a: c.aId, b: c.bId, topicId: c.topicId })),
    statEdges: game.connections.map((c) => ({ id: c.id, a: c.aId, b: c.bId, topicId: c.topicId, createdAt: c.createdAt })),
  };
}
