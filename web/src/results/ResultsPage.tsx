import { useMemo, useRef, useState, type ComponentType } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { graphData, useGame } from '../admin/gameData';
import { makeTopicColors } from '../graph/palette';
import { strings } from '../strings';
import { ConnectorsView } from './ConnectorsView';
import { GroupsView } from './GroupsView';
import { MatrixView } from './MatrixView';
import { NetworkView } from './NetworkView';
import { ReplayView } from './ReplayView';
import { SpotlightView } from './SpotlightView';
import { SummaryView } from './SummaryView';
import { TopicsView } from './TopicsView';
import { UnexpectedView } from './UnexpectedView';
import type { ViewProps } from './types';

interface ViewDefinition {
  id: string;
  label: string;
  Component: ComponentType<ViewProps>;
}

const VIEWS: readonly ViewDefinition[] = [
  { id: 'network', label: strings.viewNetwork, Component: NetworkView },
  { id: 'topics', label: strings.viewTopics, Component: TopicsView },
  { id: 'connectors', label: strings.viewConnectors, Component: ConnectorsView },
  { id: 'unexpected', label: strings.viewUnexpected, Component: UnexpectedView },
  { id: 'groups', label: strings.viewGroups, Component: GroupsView },
  { id: 'spotlight', label: strings.viewSpotlight, Component: SpotlightView },
  { id: 'matrix', label: strings.viewMatrix, Component: MatrixView },
  { id: 'replay', label: strings.viewReplay, Component: ReplayView },
  { id: 'summary', label: strings.viewSummary, Component: SummaryView },
];

function fileName(gameName: string, view: string): string {
  const slug = gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
  return `${slug}-${view}.png`;
}

/** End-of-game results for the big screen: nine views, each exportable as an image. */
export function ResultsPage(props: { animate?: boolean }) {
  const { gameId = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const [error, setError] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);
  const frame = useRef<HTMLElement>(null);
  const live = useGame(gameId, setError);
  const game = live.data;

  const data = useMemo(() => (game ? graphData(game) : undefined), [game]);
  const topicColor = useMemo(() => makeTopicColors(game?.topics ?? []), [game?.topics]);

  const current = VIEWS.find((v) => v.id === search.get('view')) ?? VIEWS[0];
  if (!current) return null;

  async function exportImage() {
    if (!frame.current || !game) return;
    setExporting(true);
    setError(undefined);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(frame.current, { pixelRatio: 2, backgroundColor: '#0f172a', cacheBust: true });
      const link = document.createElement('a');
      link.download = fileName(game.name, current?.id ?? 'view');
      link.href = url;
      link.click();
    } catch {
      setError(strings.exportFailed);
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="screen results">
      <header className="screen-head">
        <h1>{game?.name ?? strings.adminLoading}</h1>
        <span className="screen-tools">
          <button type="button" className="link-button" onClick={() => void exportImage()} disabled={!game || exporting}>
            {exporting ? strings.exporting : strings.exportImage}
          </button>
          <button type="button" className="link-button" onClick={() => void document.documentElement.requestFullscreen?.()}>
            {strings.fullscreen}
          </button>
          <Link to={`/admin/games/${gameId}`}>{strings.backToGame}</Link>
        </span>
      </header>

      <nav className="view-tabs" aria-label={strings.resultsViews}>
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`tab${view.id === current.id ? ' active' : ''}`}
            aria-current={view.id === current.id ? 'page' : undefined}
            onClick={() => setSearch({ view: view.id }, { replace: true })}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {live.offline && (
        <p className="warning" role="status">
          {strings.reconnecting}
        </p>
      )}

      {game && data ? (
        <section ref={frame} className="frame" aria-label={current.label}>
          <h2 className="frame-title">
            {game.name} · {current.label}
          </h2>
          <current.Component
            key={current.id}
            game={game}
            people={data.people}
            nodes={data.nodes}
            edges={data.edges}
            statEdges={data.statEdges}
            topicColor={topicColor}
            animate={props.animate ?? true}
          />
        </section>
      ) : (
        !error && <p role="status">{strings.adminLoading}</p>
      )}
    </main>
  );
}
