import type { GameDetails, StatEdge, StatPerson } from '@ctd/shared';
import type { GraphEdge, GraphNode } from '../graph/NetworkGraph';

/** What every results view receives: the game plus its data in the shapes graphs and statistics need. */
export interface ViewProps {
  game: GameDetails;
  people: StatPerson[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  statEdges: StatEdge[];
  topicColor: (topicId: string) => string;
  /** False in tests so layouts do not animate. */
  animate: boolean;
}
